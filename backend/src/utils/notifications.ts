import { db } from "../db/connection";
import { jobs, inAppNotifications, users } from "../schema";
import { eq, and } from "drizzle-orm";
import { getTenantUrlByOrgId } from "./url";

interface NotificationParams {
  orgId: string;
  ticketId: string;
  ticketCode: number;
  ticketSubject: string;
  userId: string; // Target user to notify
  title: string;
  message: string;
  emailSubject?: string;
  emailHtml?: string;
}

/**
 * Helper to queue notifications across multiple channels (In-app insert, email background job, slack webhook).
 */
export async function queueNotification(params: NotificationParams) {
  try {
    const { orgId, ticketId, ticketCode, ticketSubject, userId, title, message, emailSubject, emailHtml } = params;

    // 1. Immediate in-app notification insertion for fast UI reactivity
    await db.insert(inAppNotifications).values({
      orgId,
      userId,
      title,
      message,
      ticketId,
      isRead: false,
    });

    // 2. Fetch target user details to locate destination email address
    const [targetUser] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const tenantBaseUrl = await getTenantUrlByOrgId(orgId);

    if (targetUser) {
      const subject = emailSubject || title;
      const html = emailHtml || `
        <div style="font-family: sans-serif; padding: 20px; color: #1f2937;">
          <h2 style="color: #2563eb; margin-bottom: 10px;">${title}</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #374151;">${message}</p>
          <div style="margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 6px;">
            <p style="margin: 0; font-size: 14px;"><strong>Ticket Subject:</strong> ${ticketSubject}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Ticket ID:</strong> #${ticketCode}</p>
          </div>
          <p style="margin-top: 25px;">
            <a href="${tenantBaseUrl}/inbox?ticket=${ticketId}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 5px;">View Ticket</a>
          </p>
        </div>
      `;

      // Enqueue SMTP Job
      await db.insert(jobs).values({
        queueName: "email",
        payload: JSON.stringify({
          orgId,
          to: targetUser.email,
          subject,
          html,
        }),
        status: "pending",
      });
    }

    // 3. Enqueue Slack webhooks alerting the workspace channel
    await db.insert(jobs).values({
      queueName: "slack",
      payload: JSON.stringify({
        orgId,
        text: `🔔 *${title}*\n${message}\n*Subject:* ${ticketSubject}\n<${tenantBaseUrl}/inbox?ticket=${ticketId}|View Ticket #${ticketCode}>`
      }),
      status: "pending",
    });
  } catch (error) {
    console.error("❌ [Notification Utility] Enqueue failure:", error);
  }
}

/**
 * Alerts all administrators in the organization when a ticket is created/unassigned.
 */
export async function alertOrgAdmins(orgId: string, ticketId: string, ticketCode: number, ticketSubject: string, title: string, message: string) {
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.role, "admin")
        )
      );

    for (const admin of admins) {
      await queueNotification({
        orgId,
        ticketId,
        ticketCode,
        ticketSubject,
        userId: admin.id,
        title,
        message,
      });
    }
  } catch (error) {
    console.error("❌ [Notification Utility] Org Admins alert failure:", error);
  }
}
