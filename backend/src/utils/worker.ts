import { db } from "../db/connection";
import { jobs, organizationNotificationSettings, inAppNotifications } from "../schema";
import { eq, and, lte } from "drizzle-orm";
import { sendMail } from "./mailer";
import { checkSLAs } from "./slaMonitor";
import { processInboundEmail } from "../services/inboundEmailService";

/**
 * Claims and executes a single pending background job.
 * Employs a database transactions lock with FOR UPDATE SKIP LOCKED.
 * 
 * @returns Promise<boolean> True if a job was found and processed, false otherwise.
 */
export async function processNextJob(): Promise<boolean> {
  let jobRecord: any = null;

  // 1. Transaction 1: Claim the job atomically
  try {
    await db.transaction(async (tx) => {
      const list = await tx
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "pending"),
            lte(jobs.runAt, new Date())
          )
        )
        .orderBy(jobs.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });

      if (list.length > 0) {
        jobRecord = list[0];
        // Mark as processing
        await tx
          .update(jobs)
          .set({
            status: "processing",
            attempts: jobRecord.attempts + 1,
            lockedUntil: new Date(Date.now() + 5 * 60 * 1000), // Lock for 5 minutes
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobRecord.id));
      }
    });
  } catch (err) {
    console.error("❌ [Worker] Failed to claim job in transaction:", err);
    return false;
  }

  if (!jobRecord) {
    return false; // No jobs pending
  }

  console.log(`⚙️ [Worker] Processing job ${jobRecord.id} from queue [${jobRecord.queueName}]`);

  let success = false;
  let errMsg = "";

  try {
    const payload = JSON.parse(jobRecord.payload);
    const orgId = payload.orgId;

    if (!orgId) {
      throw new Error("Job payload missing organization ID context.");
    }

    // 2. Assert tenant settings before channel execution
    if (jobRecord.queueName === "inbound_email") {
      await processInboundEmail(payload.inboundEmailId);
      success = true;
    } else if (["email", "slack", "whatsapp", "in_app"].includes(jobRecord.queueName)) {
      const [settings] = await db
        .select()
        .from(organizationNotificationSettings)
        .where(
          and(
            eq(organizationNotificationSettings.orgId, orgId),
            eq(organizationNotificationSettings.channel, jobRecord.queueName)
          )
        )
        .limit(1);

      // If configuration exists and channel is disabled, skip sending and mark complete
      if (settings && !settings.enabled) {
        console.log(`⚙️ [Worker] Skipping disabled channel job ${jobRecord.id} (Channel: ${jobRecord.queueName}) for Org: ${orgId}`);
        success = true;
      } else {
        const config = settings?.config || {};

        if (jobRecord.queueName === "email") {
          await sendMail(config, payload.to, payload.subject, payload.html);
          success = true;
        } else if (jobRecord.queueName === "slack") {
          if (!config.webhookUrl) {
            console.log("⚠️ [Worker] Slack webhook Url is not configured. Logged output:");
            console.log(`Slack Text: ${payload.text}`);
          } else {
            const res = await fetch(config.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: payload.text }),
            });
            if (!res.ok) {
              throw new Error(`Slack Webhook HTTP post failed with status: ${res.status}`);
            }
          }
          success = true;
        } else if (jobRecord.queueName === "whatsapp") {
          console.log(`⚙️ [Worker WhatsApp Mock] Token: ${config.apiToken || "none"}, PhoneId: ${config.phoneId || "none"}`);
          console.log(`WhatsApp Alert sent to ${payload.to}: ${payload.body || ""}`);
          success = true;
        } else if (jobRecord.queueName === "in_app") {
          await db.insert(inAppNotifications).values({
            orgId,
            userId: payload.userId,
            title: payload.title,
            message: payload.message,
            ticketId: payload.ticketId,
            isRead: false,
          });
          success = true;
        }
      }
    } else {
      throw new Error(`Unsupported queue name target: ${jobRecord.queueName}`);
    }
  } catch (err: any) {
    console.error(`❌ [Worker] Execution failed for job ${jobRecord.id}:`, err);
    success = false;
    errMsg = err?.message || String(err);
  }

  // 3. Update job completion/retry status
  try {
    const isRetryable = jobRecord.attempts < jobRecord.maxAttempts;
    await db
      .update(jobs)
      .set({
        status: success ? "completed" : (isRetryable ? "pending" : "failed"),
        errorMessage: success ? null : errMsg,
        completedAt: success ? new Date() : null,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobRecord.id));
  } catch (err) {
    console.error(`❌ [Worker] Failed to update job status for ${jobRecord.id}:`, err);
  }

  return true;
}

/**
 * Initializes loops for background task execution and SLA monitoring cron checking.
 */
export function startWorker() {
  console.log("⚙️ [Worker] Initializing background notification queue worker...");

  // Run initial SLA check immediately on startup
  setTimeout(async () => {
    try {
      await checkSLAs();
    } catch (err) {
      console.error("⏱️ [Worker] Initial SLA check failed:", err);
    }
  }, 1000);

  // Poll database queue loop every 5 seconds
  setInterval(async () => {
    try {
      let processed = true;
      while (processed) {
        processed = await processNextJob();
      }
    } catch (err) {
      console.error("⚙️ [Worker] Queue polling error:", err);
    }
  }, 5000);

  // SLA monitor checker cron loop (every 60 seconds)
  setInterval(async () => {
    try {
      await checkSLAs();
    } catch (err) {
      console.error("⏱️ [Worker] SLA cron check error:", err);
    }
  }, 60000);
}
