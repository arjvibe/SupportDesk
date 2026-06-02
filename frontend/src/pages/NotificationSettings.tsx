import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { ShieldAlert, ShieldCheck } from "lucide-react";

const API_BASE = getApiBase();

export default function NotificationSettings() {
  const queryClient = useQueryClient();

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

  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);

  // Fetch notification channel configurations
  const { data: notificationSettings = [], isLoading } = useQuery<any[]>({
    queryKey: ["org_notification_settings"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/notifications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

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

  // Mutation to update notification channel configurations
  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: { channel: string; enabled: boolean; config: any }) => {
      const res = await fetch(`${API_BASE}/settings/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update channel settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_notification_settings"] });
    },
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-10 text-center font-mono">
        Loading workspace notification settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm font-sans text-ink">
        <div className="border-b border-black/5 pb-4 mb-6">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
            Notification Outbound Channels
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure system outbound alert integrations. Enabled channels process notification queue jobs in the background.
          </p>
        </div>

        {notifSuccess && (
          <div className="mb-6 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 mt-0.5" />
            <span>{notifSuccess}</span>
          </div>
        )}

        {notifError && (
          <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{notifError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* SMTP Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Email Integration (SMTP)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => {
                      setEmailEnabled(e.target.checked);
                      updateSettingsMutation.mutate({
                        channel: "email",
                        enabled: e.target.checked,
                        config: {
                          host: smtpHost,
                          port: Number(smtpPort),
                          user: smtpUser,
                          password: smtpPassword,
                          secure: smtpSecure,
                          fromEmail: smtpFromEmail
                        }
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-black/15 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              <div className="space-y-3 text-left">
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
                updateSettingsMutation.mutate({
                  channel: "email",
                  enabled: emailEnabled,
                  config: {
                    host: smtpHost,
                    port: Number(smtpPort),
                    user: smtpUser,
                    password: smtpPassword,
                    secure: smtpSecure,
                    fromEmail: smtpFromEmail
                  }
                }, {
                  onSuccess: () => {
                    setNotifSuccess("SMTP configuration saved successfully.");
                    setTimeout(() => setNotifSuccess(null), 3000);
                  },
                  onError: (err: any) => {
                    setNotifError(err.message || "Failed to save SMTP settings.");
                    setTimeout(() => setNotifError(null), 3000);
                  }
                });
              }}
              className="mt-4 w-full bg-brand-primary text-brand-secondary py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              Save SMTP Credentials
            </button>
          </div>

          {/* Slack Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Slack Webhook URL
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slackEnabled}
                    onChange={(e) => {
                      setSlackEnabled(e.target.checked);
                      updateSettingsMutation.mutate({
                        channel: "slack",
                        enabled: e.target.checked,
                        config: { webhookUrl: slackWebhookUrl }
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-black/15 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              <div className="space-y-3 text-left">
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
                updateSettingsMutation.mutate({
                  channel: "slack",
                  enabled: slackEnabled,
                  config: { webhookUrl: slackWebhookUrl }
                }, {
                  onSuccess: () => {
                    setNotifSuccess("Slack Webhook configuration saved.");
                    setTimeout(() => setNotifSuccess(null), 3000);
                  },
                  onError: (err: any) => {
                    setNotifError(err.message || "Failed to save Slack settings.");
                    setTimeout(() => setNotifError(null), 3000);
                  }
                });
              }}
              className="mt-4 w-full bg-brand-primary text-brand-secondary py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              Save Slack Webhook
            </button>
          </div>

          {/* WhatsApp Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  WhatsApp Alerts
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => {
                      setWhatsappEnabled(e.target.checked);
                      updateSettingsMutation.mutate({
                        channel: "whatsapp",
                        enabled: e.target.checked,
                        config: { apiToken: whatsappApiToken, phoneId: whatsappPhoneId }
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-black/15 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              <div className="space-y-3 text-left">
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">API Token</span>
                  <input
                    type="password"
                    placeholder="Meta access token"
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
                updateSettingsMutation.mutate({
                  channel: "whatsapp",
                  enabled: whatsappEnabled,
                  config: { apiToken: whatsappApiToken, phoneId: whatsappPhoneId }
                }, {
                  onSuccess: () => {
                    setNotifSuccess("WhatsApp configuration saved.");
                    setTimeout(() => setNotifSuccess(null), 3000);
                  },
                  onError: (err: any) => {
                    setNotifError(err.message || "Failed to save WhatsApp settings.");
                    setTimeout(() => setNotifError(null), 3000);
                  }
                });
              }}
              className="mt-4 w-full bg-brand-primary text-brand-secondary py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              Save WhatsApp Settings
            </button>
          </div>

          {/* In-App Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  In-App Notifications
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={(e) => {
                      setInAppEnabled(e.target.checked);
                      updateSettingsMutation.mutate({
                        channel: "in_app",
                        enabled: e.target.checked,
                        config: {}
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-black/15 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed text-left">
                Enables users to see visual notifications directly in their navigation bar's bell icon when tickets are submitted, assigned, replied to, or breach SLAs.
              </p>
            </div>
            <div className="mt-8 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
              System Native Channel
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
