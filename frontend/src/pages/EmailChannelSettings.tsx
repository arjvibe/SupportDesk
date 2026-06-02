import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { getApiBase } from "../utils/api";

const API_BASE = getApiBase();

type Mailbox = {
  emailAddress: string;
  isActive: boolean;
  defaultClientId: string | null;
  defaultTeamId: string | null;
  defaultPriority: "low" | "normal" | "high" | "urgent";
  unknownSenderPolicy: string;
  replyBehavior: string;
  autoAckEnabled: boolean;
};

export default function EmailChannelSettings() {
  const queryClient = useQueryClient();
  const [emailAddress, setEmailAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [defaultClientId, setDefaultClientId] = useState("");
  const [defaultTeamId, setDefaultTeamId] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<Mailbox["defaultPriority"]>("normal");
  const [unknownSenderPolicy, setUnknownSenderPolicy] = useState("quarantine");
  const [replyBehavior, setReplyBehavior] = useState("reopen_resolved");
  const [autoAckEnabled, setAutoAckEnabled] = useState(true);
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
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/settings/email-channel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          emailAddress,
          isActive,
          defaultClientId: defaultClientId || null,
          defaultTeamId: defaultTeamId || null,
          defaultPriority,
          unknownSenderPolicy,
          replyBehavior,
          autoAckEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save email channel settings");
      return data;
    },
    onSuccess: () => {
      setError(null);
      setNotice("Email channel settings saved.");
      queryClient.invalidateQueries({ queryKey: ["email_channel_settings"] });
    },
    onError: (err: any) => {
      setNotice(null);
      setError(err.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/settings/email-channel/test-inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toEmail: emailAddress,
          fromEmail: testFromEmail,
          subject: testSubject,
          textBody: testBody,
          providerMessageId: `dev-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to enqueue test email");
      return data;
    },
    onSuccess: () => {
      setError(null);
      setNotice("Test inbound email queued. The worker will convert it into a ticket shortly.");
      queryClient.invalidateQueries({ queryKey: ["email_channel_inbound_log"] });
    },
    onError: (err: any) => {
      setNotice(null);
      setError(err.message);
    },
  });

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-10 text-center font-mono">Loading email channel settings...</div>;
  }

  return (
    <div className="space-y-6 font-sans text-ink">
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4 mb-6">
          <div>
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
              Email Channel
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure how inbound emails become support tickets for this workspace.
            </p>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-right">
            <div>Provider: {settings?.platform?.provider || "dev"}</div>
            <div>Webhook: {settings?.platform?.webhookConfigured ? "configured" : "dev/test"}</div>
          </div>
        </div>

        {notice && (
          <div className="mb-5 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="mb-5 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="border border-black/10 rounded-xl p-5 bg-surface/5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2">
                <Mail className="size-4" />
                Mailbox Behavior
              </span>
              <label className="flex items-center gap-2 text-xs font-mono">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Support Email</span>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="acme@support.yourapp.com"
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Default Client</span>
                  <select value={defaultClientId} onChange={(e) => setDefaultClientId(e.target.value)} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs">
                    <option value="">Domain matched</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Default Team</span>
                  <select value={defaultTeamId} onChange={(e) => setDefaultTeamId(e.target.value)} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs">
                    <option value="">Routing rules</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Priority</span>
                  <select value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value as Mailbox["defaultPriority"])} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Unknown Sender</span>
                  <select value={unknownSenderPolicy} onChange={(e) => setUnknownSenderPolicy(e.target.value)} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs">
                    <option value="quarantine">Quarantine</option>
                    <option value="reject">Reject</option>
                    <option value="create_contact_if_domain_matches">Create if domain matches</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Reply Behavior</span>
                  <select value={replyBehavior} onChange={(e) => setReplyBehavior(e.target.value)} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs">
                    <option value="reopen_resolved">Reopen resolved</option>
                    <option value="ignore_closed">Ignore closed</option>
                    <option value="allow_reply">Allow reply</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={autoAckEnabled} onChange={(e) => setAutoAckEnabled(e.target.checked)} />
                Send acknowledgement email when a new ticket is created
              </label>

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-black text-canvas rounded-lg text-xs font-semibold hover:bg-black/85 disabled:opacity-50"
              >
                Save Email Channel
              </button>
            </div>
          </section>

          <section className="border border-black/10 rounded-xl p-5 bg-surface/5">
            <div className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2 mb-4">
              <Send className="size-4" />
              Test Inbound Email
            </div>
            <div className="space-y-3">
              <input value={testFromEmail} onChange={(e) => setTestFromEmail(e.target.value)} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs font-mono" />
              <input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs" />
              <textarea value={testBody} onChange={(e) => setTestBody(e.target.value)} rows={5} className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs resize-none" />
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !emailAddress}
                className="px-4 py-2 bg-black text-canvas rounded-lg text-xs font-semibold hover:bg-black/85 disabled:opacity-50"
              >
                Queue Test Email
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider font-mono mb-4">Recent Inbound Emails</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-black/10">
              <tr>
                <th className="text-left py-2">From</th>
                <th className="text-left py-2">Subject</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {inboundEmails.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No inbound emails have been received yet.</td></tr>
              ) : inboundEmails.map((row) => (
                <tr key={row.id} className="border-b border-black/5">
                  <td className="py-2 font-mono">{row.fromEmail}</td>
                  <td className="py-2">{row.subject}</td>
                  <td className="py-2 font-mono">{row.status}</td>
                  <td className="py-2 text-muted-foreground">{row.errorMessage || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
