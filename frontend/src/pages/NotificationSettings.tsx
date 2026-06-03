import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import {
  SmtpForm,
  SlackForm,
  WhatsAppForm,
} from "@/features/tenant/notifications";

const API_BASE = getApiBase();

export default function NotificationSettings() {
  const queryClient = useQueryClient();

  // Notification settings states
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState("");

  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  const [whatsappApiToken, setWhatsappApiToken] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");

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
        setSmtpPort(Number(email.config?.port || 587));
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

  const handleSmtpSubmit = (data: any) => {
    setNotifSuccess(null);
    setNotifError(null);
    updateSettingsMutation.mutate(
      {
        channel: "email",
        enabled: emailEnabled,
        config: data,
      },
      {
        onSuccess: () => {
          setNotifSuccess("SMTP configuration saved successfully.");
          setTimeout(() => setNotifSuccess(null), 3000);
        },
        onError: (err: any) => {
          setNotifError(err.message || "Failed to save SMTP settings.");
        },
      }
    );
  };

  const handleSlackSubmit = (data: any) => {
    setNotifSuccess(null);
    setNotifError(null);
    updateSettingsMutation.mutate(
      {
        channel: "slack",
        enabled: slackEnabled,
        config: data,
      },
      {
        onSuccess: () => {
          setNotifSuccess("Slack Webhook configuration saved.");
          setTimeout(() => setNotifSuccess(null), 3000);
        },
        onError: (err: any) => {
          setNotifError(err.message || "Failed to save Slack settings.");
        },
      }
    );
  };

  const handleWhatsappSubmit = (data: any) => {
    setNotifSuccess(null);
    setNotifError(null);
    updateSettingsMutation.mutate(
      {
        channel: "whatsapp",
        enabled: whatsappEnabled,
        config: data,
      },
      {
        onSuccess: () => {
          setNotifSuccess("WhatsApp configuration saved.");
          setTimeout(() => setNotifSuccess(null), 3000);
        },
        onError: (err: any) => {
          setNotifError(err.message || "Failed to save WhatsApp settings.");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-10 text-center font-mono select-none">
        Loading workspace notification settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm font-sans text-ink">
        <div className="border-b border-black/5 pb-4 mb-6 select-none">
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
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono select-none">
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
                          port: smtpPort,
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

              <SmtpForm
                initialValues={{
                  host: smtpHost,
                  port: smtpPort,
                  user: smtpUser,
                  password: smtpPassword,
                  secure: smtpSecure,
                  fromEmail: smtpFromEmail,
                }}
                onSubmit={handleSmtpSubmit}
                isLoading={updateSettingsMutation.isPending}
              />
            </div>
          </div>

          {/* Slack Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono select-none">
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

              <SlackForm
                initialValues={{ webhookUrl: slackWebhookUrl }}
                onSubmit={handleSlackSubmit}
                isLoading={updateSettingsMutation.isPending}
              />
            </div>
          </div>

          {/* WhatsApp Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono select-none">
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

              <WhatsAppForm
                initialValues={{
                  apiToken: whatsappApiToken,
                  phoneId: whatsappPhoneId,
                }}
                onSubmit={handleWhatsappSubmit}
                isLoading={updateSettingsMutation.isPending}
              />
            </div>
          </div>

          {/* In-App Config */}
          <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="text-xs font-bold uppercase tracking-wider font-mono select-none">
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
              <p className="text-[11px] text-muted-foreground leading-relaxed text-left select-none">
                Enables users to see visual notifications directly in their navigation bar's bell icon when tickets are submitted, assigned, replied to, or breach SLAs.
              </p>
            </div>
            <div className="mt-8 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center select-none">
              System Native Channel
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
