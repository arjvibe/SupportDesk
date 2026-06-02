import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { inboundEmails, organizationNotificationSettings, organizations, supportMailboxes } from "../schema";
import { desc, eq, and } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";
import { getStorageService } from "../utils/storage";
import { enqueueInboundEmail } from "../services/inboundEmailService";

const router = Router();

/**
 * GET /api/settings/notifications
 * 
 * Retrieves all channel configurations registered under the active organization.
 * Access is restricted to Admins only.
 */
router.get(
  "/notifications",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    try {
      const settings = await db
        .select()
        .from(organizationNotificationSettings)
        .where(eq(organizationNotificationSettings.orgId, req.user!.orgId));

      return res.json(settings);
    } catch (error) {
      console.error("Retrieve notification settings failed:", error);
      return res.status(500).json({ error: "Failed to retrieve notification settings" });
    }
  }
);

/**
 * PUT /api/settings/notifications
 * 
 * Saves/updates configuration parameters and toggles for a specific channel.
 * Access is restricted to Admins only.
 */
router.put(
  "/notifications",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { channel, enabled, config } = req.body;

    if (!channel) {
      return res.status(400).json({ error: "Channel is required" });
    }

    try {
      // Find if settings already exist for this org and channel
      const existing = await db
        .select()
        .from(organizationNotificationSettings)
        .where(
          and(
            eq(organizationNotificationSettings.orgId, req.user!.orgId),
            eq(organizationNotificationSettings.channel, channel)
          )
        )
        .limit(1);

      let record;
      if (existing.length > 0) {
        // Update existing record
        const [updated] = await db
          .update(organizationNotificationSettings)
          .set({
            enabled: enabled !== undefined ? enabled : existing[0].enabled,
            config: config !== undefined ? { ...existing[0].config, ...config } : existing[0].config,
            updatedAt: new Date(),
          })
          .where(eq(organizationNotificationSettings.id, existing[0].id))
          .returning();
        record = updated;
      } else {
        // Insert new record
        const [inserted] = await db
          .insert(organizationNotificationSettings)
          .values({
            orgId: req.user!.orgId,
            channel,
            enabled: enabled !== undefined ? enabled : true,
            config: config || {},
          })
          .returning();
        record = inserted;
      }

      return res.json(record);
    } catch (error) {
      console.error("Update notification settings failed:", error);
      return res.status(500).json({ error: "Failed to update notification settings" });
    }
  }
);

/**
 * GET /api/settings/email-channel
 *
 * Retrieves the tenant's inbound email-to-ticket mailbox configuration.
 */
router.get(
  "/email-channel",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    try {
      const [mailbox] = await db
        .select()
        .from(supportMailboxes)
        .where(eq(supportMailboxes.orgId, req.user!.orgId))
        .limit(1);

      return res.json({
        mailbox: mailbox || null,
        platform: {
          provider: process.env.INBOUND_EMAIL_PROVIDER || "dev",
          publicBaseUrl: process.env.INBOUND_EMAIL_PUBLIC_BASE_URL || null,
          maxAttachmentMb: Number(process.env.INBOUND_EMAIL_MAX_ATTACHMENT_MB || 10),
          webhookConfigured: !!process.env.INBOUND_EMAIL_WEBHOOK_SECRET,
        },
      });
    } catch (error) {
      console.error("Retrieve email channel settings failed:", error);
      return res.status(500).json({ error: "Failed to retrieve email channel settings" });
    }
  }
);

/**
 * PUT /api/settings/email-channel
 *
 * Creates or updates tenant-admin configurable email-to-ticket behavior.
 */
router.put(
  "/email-channel",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const {
      emailAddress,
      isActive,
      defaultClientId,
      defaultTeamId,
      defaultPriority,
      unknownSenderPolicy,
      replyBehavior,
      autoAckEnabled,
    } = req.body;

    if (!emailAddress) {
      return res.status(400).json({ error: "Support email address is required" });
    }

    try {
      const normalizedEmail = String(emailAddress).trim().toLowerCase();
      const [existing] = await db
        .select()
        .from(supportMailboxes)
        .where(eq(supportMailboxes.orgId, req.user!.orgId))
        .limit(1);

      const values = {
        emailAddress: normalizedEmail,
        provider: process.env.INBOUND_EMAIL_PROVIDER || "dev",
        isActive: isActive !== undefined ? !!isActive : true,
        defaultClientId: defaultClientId || null,
        defaultTeamId: defaultTeamId || null,
        defaultPriority: defaultPriority || "normal",
        unknownSenderPolicy: unknownSenderPolicy || "quarantine",
        replyBehavior: replyBehavior || "reopen_resolved",
        autoAckEnabled: autoAckEnabled !== undefined ? !!autoAckEnabled : true,
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(supportMailboxes)
          .set(values)
          .where(eq(supportMailboxes.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db
        .insert(supportMailboxes)
        .values({
          orgId: req.user!.orgId,
          ...values,
        })
        .returning();
      return res.status(201).json(created);
    } catch (error: any) {
      console.error("Update email channel settings failed:", error);
      if (error?.message?.includes("duplicate")) {
        return res.status(409).json({ error: "This support email address is already assigned to another workspace" });
      }
      return res.status(500).json({ error: "Failed to update email channel settings" });
    }
  }
);

/**
 * GET /api/settings/email-channel/inbound-emails
 *
 * Lists recent inbound emails and processing outcomes for admin review.
 */
router.get(
  "/email-channel/inbound-emails",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(inboundEmails)
        .where(eq(inboundEmails.orgId, req.user!.orgId))
        .orderBy(desc(inboundEmails.createdAt))
        .limit(50);

      return res.json(rows);
    } catch (error) {
      console.error("Retrieve inbound email log failed:", error);
      return res.status(500).json({ error: "Failed to retrieve inbound email log" });
    }
  }
);

/**
 * POST /api/settings/email-channel/test-inbound
 *
 * Admin-only development helper. Pushes a sample inbound email through the same queue
 * as provider webhooks, so the flow can be tested before DNS/provider setup is ready.
 */
router.post(
  "/email-channel/test-inbound",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    try {
      const inbound = await enqueueInboundEmail({
        provider: "dev",
        providerMessageId: req.body.providerMessageId || `dev-${Date.now()}`,
        fromEmail: req.body.fromEmail,
        fromName: req.body.fromName || null,
        toEmail: req.body.toEmail,
        cc: req.body.cc || null,
        subject: req.body.subject || "(No subject)",
        textBody: req.body.textBody || req.body.body || "",
        htmlBody: req.body.htmlBody || null,
        messageIdHeader: req.body.messageIdHeader || null,
        inReplyToHeader: req.body.inReplyToHeader || null,
        referencesHeader: req.body.referencesHeader || null,
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
        rawPayload: req.body,
      });

      return res.status(202).json(inbound);
    } catch (error: any) {
      console.error("Test inbound email failed:", error);
      return res.status(400).json({ error: error?.message || "Failed to enqueue test inbound email" });
    }
  }
);

/**
 * PUT /api/settings/branding
 * 
 * Saves/updates workspace branding settings (logo URL, primary color, secondary color)
 * for the authenticated user's organization.
 * Access is restricted to Admins only.
 */
router.put(
  "/branding",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { logoUrl, primaryColor, secondaryColor } = req.body;

    try {
      // 1. Fetch current logo url to identify if it is changing
      const currentOrg = await db
        .select({ logoUrl: organizations.logoUrl })
        .from(organizations)
        .where(eq(organizations.id, req.user!.orgId))
        .limit(1);

      const oldLogoUrl = currentOrg.length > 0 ? currentOrg[0].logoUrl : null;

      // 2. Perform database update
      const [updated] = await db
        .update(organizations)
        .set({
          logoUrl: logoUrl !== undefined ? logoUrl : null,
          primaryColor: primaryColor !== undefined ? primaryColor : null,
          secondaryColor: secondaryColor !== undefined ? secondaryColor : null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, req.user!.orgId))
        .returning();

      // 3. Clean up the old logo asset from S3/disk if the path changed
      if (oldLogoUrl && oldLogoUrl !== logoUrl) {
        if (oldLogoUrl.startsWith("/uploads/") || oldLogoUrl.includes(req.user!.orgId)) {
          const storageService = getStorageService();
          await storageService.deleteFile(oldLogoUrl);
        }
      }

      return res.json(updated);
    } catch (error) {
      console.error("Update branding settings failed:", error);
      return res.status(500).json({ error: "Failed to update branding settings" });
    }
  }
);

export default router;
