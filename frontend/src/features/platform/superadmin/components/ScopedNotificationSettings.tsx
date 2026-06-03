import { useEffect, useState } from "react";
import { Mail, Slack, ToggleLeft, ToggleRight, ShieldCheck, ShieldAlert } from "lucide-react";
import { useOrgNotifications, useUpdateOrgNotification } from "../hooks/useSuperAdmin";

interface ScopedNotificationSettingsProps {
  orgId: string;
}

export function ScopedNotificationSettings({ orgId }: ScopedNotificationSettingsProps) {
  // Notification settings states
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState("");

  const [slackEnabled, setSlackEnabled] = useState(true);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappApiToken, setWhatsappApiToken] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");

  const [inAppEnabled, setInAppEnabled] = useState(true);

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch settings for this specific Org
  const { data: notificationSettings = [], isLoading } = useOrgNotifications(orgId);
  const updateNotificationMutation = useUpdateOrgNotification(orgId);

  // Sync state when DB values fetch
  useEffect(() => {
    if (notificationSettings.length > 0) {
      const email = notificationSettings.find((s) => s.channel === "email");
      if (email) {
        setEmailEnabled(email.enabled);
        setSmtpHost(email.config?.host || "");
        setSmtpPort(String(email.config?.port || "587"));
        setSmtpUser(email.config?.user || "");
        setSmtpPassword(email.config?.password || "");
        setSmtpSecure(!!email.config?.secure);
        setSmtpFromEmail(email.config?.fromEmail || "");
      }

      const slack = notificationSettings.find((s) => s.channel === "slack");
      if (slack) {
        setSlackEnabled(slack.enabled);
        setSlackWebhookUrl(slack.config?.webhookUrl || "");
      }

      const whatsapp = notificationSettings.find((s) => s.channel === "whatsapp");
      if (whatsapp) {
        setWhatsappEnabled(whatsapp.enabled);
        setWhatsappApiToken(whatsapp.config?.apiToken || "");
        setWhatsappPhoneId(whatsapp.config?.phoneId || "");
      }

      const inApp = notificationSettings.find((s) => s.channel === "in_app");
      if (inApp) {
        setInAppEnabled(inApp.enabled);
      }
    }
  }, [notificationSettings]);

  const handleUpdateChannel = (channel: string, enabled: boolean, config: any, message: string) => {
    updateNotificationMutation.mutate({
      channel,
      enabled,
      config,
    }, {
      onSuccess: () => {
        setSaveSuccess(message);
        setTimeout(() => setSaveSuccess(null), 3000);
      },
      onError: (err: any) => {
        setSaveError(err.message || "Failed to update channel settings.");
        setTimeout(() => setSaveError(null), 3000);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-10 text-center font-mono">
        Retrieving organization settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveSuccess && (
        <div className="p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* SMTP Configuration */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Mail className="size-4 text-muted-foreground" />
                Email Settings (SMTP)
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !emailEnabled;
                  setEmailEnabled(newEnabled);
                  handleUpdateChannel("email", newEnabled, {
                    host: smtpHost,
                    port: Number(smtpPort),
                    user: smtpUser,
                    password: smtpPassword,
                    secure: smtpSecure,
                    fromEmail: smtpFromEmail
                  }, `SMTP status updated.`);
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {emailEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2 block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP Host</span>
                  <input
                    type="text"
                    placeholder="smtp.mailtrap.io"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
                <label className="col-span-1 block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP Port</span>
                  <input
                    type="text"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP User</span>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP Password</span>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">From Email</span>
                  <input
                    type="email"
                    placeholder="support@company.com"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    className="w-40 bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="rounded border-black/10 text-ink focus:ring-black"
                  />
                  <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">Use SSL/TLS</span>
                </label>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleUpdateChannel("email", emailEnabled, {
                host: smtpHost,
                port: Number(smtpPort),
                user: smtpUser,
                password: smtpPassword,
                secure: smtpSecure,
                fromEmail: smtpFromEmail
              }, "SMTP Credentials updated successfully.");
            }}
            className="mt-4 w-full bg-ink text-canvas py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Save SMTP Credentials
          </button>
        </div>

        {/* Slack Configuration */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Slack className="size-4 text-muted-foreground" />
                Slack Channel Webhook
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !slackEnabled;
                  setSlackEnabled(newEnabled);
                  handleUpdateChannel("slack", newEnabled, { webhookUrl: slackWebhookUrl }, "Slack webhook status updated.");
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {slackEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Webhook URL</span>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleUpdateChannel("slack", slackEnabled, { webhookUrl: slackWebhookUrl }, "Slack Webhook configuration saved.");
            }}
            className="mt-4 w-full bg-ink text-canvas py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Save Slack Webhook
          </button>
        </div>

        {/* WhatsApp Config */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                WhatsApp API Gateway
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !whatsappEnabled;
                  setWhatsappEnabled(newEnabled);
                  handleUpdateChannel("whatsapp", newEnabled, { apiToken: whatsappApiToken, phoneId: whatsappPhoneId }, "WhatsApp status updated.");
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {whatsappEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Meta API Token</span>
                <input
                  type="password"
                  placeholder="Meta system user access token"
                  value={whatsappApiToken}
                  onChange={(e) => setWhatsappApiToken(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Phone Number ID</span>
                <input
                  type="text"
                  placeholder="Meta phone id"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleUpdateChannel("whatsapp", whatsappEnabled, { apiToken: whatsappApiToken, phoneId: whatsappPhoneId }, "WhatsApp Meta credentials updated.");
            }}
            className="mt-4 w-full bg-ink text-canvas py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Save WhatsApp Credentials
          </button>
        </div>

        {/* In-App Native Config */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                In-App Native Feed
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !inAppEnabled;
                  setInAppEnabled(newEnabled);
                  handleUpdateChannel("in_app", newEnabled, {}, "In-app alerts status updated.");
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {inAppEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Enables staff and clients to receive dynamic alerts inside the system navigation header bell timeline drawer. Runs natively.
            </p>
          </div>
          <div className="mt-8 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
            System Native Channel
          </div>
        </div>
      </div>
    </div>
  );
}
