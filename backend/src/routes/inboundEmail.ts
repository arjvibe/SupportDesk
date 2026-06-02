import { Router, Request, Response } from "express";
import { enqueueInboundEmail } from "../services/inboundEmailService";

const router = Router();

function verifyInboundSecret(req: Request) {
  const expected = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!expected) return true;
  const provided = req.header("x-inbound-email-secret") || req.query.secret;
  return provided === expected;
}

function normalizeProviderPayload(provider: string, body: any) {
  const headers = body.headers || {};
  return {
    provider,
    providerMessageId: body.providerMessageId || body["message-id"] || body.MessageID || headers["message-id"] || `${provider}-${Date.now()}`,
    fromEmail: body.fromEmail || body.from || body.From,
    fromName: body.fromName || body.senderName || null,
    toEmail: body.toEmail || body.recipient || body.to || body.To,
    cc: body.cc || body.Cc || null,
    subject: body.subject || body.Subject || "(No subject)",
    textBody: body.textBody || body.text || body["body-plain"] || "",
    htmlBody: body.htmlBody || body.html || body["body-html"] || null,
    messageIdHeader: body.messageIdHeader || body.messageId || headers["message-id"] || null,
    inReplyToHeader: body.inReplyToHeader || headers["in-reply-to"] || null,
    referencesHeader: body.referencesHeader || headers.references || null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    rawPayload: body,
  };
}

/**
 * POST /api/inbound-email/:provider
 *
 * Public provider webhook. This route intentionally does not use the normal JWT
 * auth flow because email providers call it directly. Access is controlled by
 * provider signature/secret verification and mailbox lookup.
 */
router.post("/:provider", async (req: Request, res: Response) => {
  try {
    if (!verifyInboundSecret(req)) {
      return res.status(401).json({ error: "Invalid inbound email webhook signature" });
    }

    const normalized = normalizeProviderPayload(req.params.provider, req.body);
    if (!normalized.fromEmail || !normalized.toEmail) {
      return res.status(400).json({ error: "Inbound email must include from and to addresses" });
    }

    const inbound = await enqueueInboundEmail(normalized);
    return res.status(202).json({ id: inbound.id, status: inbound.status });
  } catch (error: any) {
    console.error("Inbound email webhook failed:", error);
    return res.status(400).json({ error: error?.message || "Failed to enqueue inbound email" });
  }
});

export default router;
