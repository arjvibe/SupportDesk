import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { getApiBase } from "../utils/api";
import { EmailChannelForm, EmailChannelFormValues } from "@/features/tenant/email";

const API_BASE = getApiBase();

export default function EmailChannelSettings() {
  const queryClient = useQueryClient();

  const [emailAddress, setEmailAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [defaultClientId, setDefaultClientId] = useState("");
  const [defaultTeamId, setDefaultTeamId] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [unknownSenderPolicy, setUnknownSenderPolicy] = useState("quarantine");
  const [replyBehavior, setReplyBehavior] = useState("reopen_resolved");
  const [autoAckEnabled, setAutoAckEnabled] = useState(true);

  // Ingestion testing form states
  const [testFromEmail, setTestFromEmail] = useState("client@maison.com");
  const [testSubject, setTestSubject] = useState("Email channel test");
  const [testBody, setTestBody] = useState("This is a test inbound email.");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["email_channel_settings"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/email-channel`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email channel settings");
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/clients`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/teams`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: inboundEmails = [] } = useQuery<any[]>({
    queryKey: ["email_channel_inbound_log"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/email-channel/inbound-emails`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  useEffect(() => {
    const mailbox = settings?.mailbox;
    if (mailbox) {
      setEmailAddress(mailbox.emailAddress || "");
      setIsActive(!!mailbox.isActive);
      setDefaultClientId(mailbox.defaultClientId || "");
      setDefaultTeamId(mailbox.defaultTeamId || "");
      setDefaultPriority(mailbox.defaultPriority || "normal");
      setUnknownSenderPolicy(mailbox.unknownSenderPolicy || "quarantine");
      setReplyBehavior(mailbox.replyBehavior || "reopen_resolved");
      setAutoAckEnabled(!!mailbox.autoAckEnabled);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/settings/email-channel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save email channel settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_channel_settings"] });
      setNotice("Inbound email channel configurations updated successfully!");
      setTimeout(() => setNotice(null), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to save settings");
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/settings/email-channel/test-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to ingest test email");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_channel_inbound_log"] });
      setNotice("Simulated email ingested! Check the inbox queue shortly.");
      setTimeout(() => setNotice(null), 3000);
      setTestSubject("Email channel test");
      setTestBody("This is another test inbound email.");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to ingest simulated mail");
    },
  });

  const handleFormSubmit = (data: EmailChannelFormValues) => {
    setError(null);
    setNotice(null);
    saveMutation.mutate({
      emailAddress: data.emailAddress,
      isActive: data.isActive,
      defaultClientId: data.defaultClientId || null,
      defaultTeamId: data.defaultTeamId || null,
      defaultPriority: data.defaultPriority,
      unknownSenderPolicy: data.unknownSenderPolicy,
      replyBehavior: data.replyBehavior,
      autoAckEnabled: data.autoAckEnabled,
    });
  };

  const handleTestIngest = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    ingestMutation.mutate({
      fromEmail: testFromEmail,
      subject: testSubject,
      body: testBody,
    });
  };

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-10 text-center font-mono select-none">
        Loading email channel configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm font-sans text-ink">
        <div className="border-b border-black/5 pb-4 mb-6 select-none">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
            Inbound Email Ingestion Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure system inbound email-to-ticket conversion logic and fallback support routing targets.
          </p>
        </div>

        {notice && (
          <div className="mb-6 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Controls Column */}
          <div className="lg:col-span-2 space-y-6">
            <EmailChannelForm
              initialValues={{
                emailAddress,
                isActive,
                defaultClientId,
                defaultTeamId,
                defaultPriority,
                unknownSenderPolicy: unknownSenderPolicy as any,
                replyBehavior: replyBehavior as any,
                autoAckEnabled,
              }}
              onSubmit={handleFormSubmit}
              isLoading={saveMutation.isPending}
              clientsList={clients}
              teamsList={teams}
            />
          </div>

          {/* Test Ingestion Console Column */}
          <div className="space-y-6">
            <div className="border border-black/10 rounded-xl p-5 bg-surface/5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-black/5 select-none">
                <Send className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Ingestion Simulator
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed select-none">
                Simulate a client inbound mail trigger to verify parser filters, auto-client mappings, default assignments and notifications.
              </p>

              <form onSubmit={handleTestIngest} className="space-y-3 text-left">
                <label className="block">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Sender Email</span>
                  <input
                    type="email"
                    required
                    value={testFromEmail}
                    onChange={(e) => setTestFromEmail(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>

                <label className="block">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Subject</span>
                  <input
                    type="text"
                    required
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>

                <label className="block">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Plaintext Body</span>
                  <textarea
                    required
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    rows={4}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono resize-none"
                  />
                </label>

                <button
                  type="submit"
                  disabled={ingestMutation.isPending}
                  className="w-full bg-black text-canvas py-2.5 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  {ingestMutation.isPending ? "Simulating mail..." : "Trigger Ingestion Test"}
                </button>
              </form>
            </div>

            {/* Inbound Emails Log list */}
            <div className="border border-black/10 rounded-xl p-5 bg-surface/5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-black/5 select-none">
                <Mail className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Parser Inbound Log
                </span>
              </div>

              {inboundEmails.length === 0 ? (
                <div className="text-[10px] text-muted-foreground py-6 text-center select-none">
                  No inbound log records captured.
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-48 text-left pr-1">
                  {inboundEmails.map((log) => (
                    <div key={log.id} className="border-b border-black/5 pb-2 last:border-0">
                      <div className="flex justify-between items-center mb-1 select-none">
                        <span className="text-[9px] font-mono font-medium truncate text-ink max-w-[12ch]">
                          {log.fromEmail}
                        </span>
                        <span className="text-[8px] font-mono text-muted-foreground">
                          {new Date(log.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-[10px] block truncate font-medium text-muted-foreground">
                        {log.subject}
                      </span>
                      <span
                        className={`text-[8px] font-mono uppercase px-1 py-0.2 rounded mt-1 inline-block select-none ${
                          log.status === "processed"
                            ? "bg-success/15 text-success"
                            : log.status === "quarantined"
                            ? "bg-warning/15 text-warning"
                            : "bg-danger/15 text-danger"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
