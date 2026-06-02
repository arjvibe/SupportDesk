import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import {
  Plus,
  X,
  ShieldAlert,
  ArrowLeft,
  Send,
  Star,
  MessageSquare,
  CheckCircle2,
  Lock,
  Paperclip,
  FileText,
  Upload,
} from "lucide-react";

type Attachment = {
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
};

type Ticket = {
  id: string;
  code: number;
  subject: string;
  description: string;
  status: "new" | "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  workstream: string | null;
  slaState: "on-track" | "at-risk" | "breached";
  slaResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientName: string;
};

type TicketMessage = {
  id: string;
  body: string;
  senderRole: "client" | "agent" | "system";
  isInternal: boolean;
  createdAt: string;
  sender: {
    firstName: string;
    lastName: string;
    email: string;
    initials: string;
  };
  attachments?: Attachment[];
};

type TicketFeedback = {
  id: string;
  rating: number;
  comment: string | null;
};

type TicketDetails = Ticket & {
  messages: TicketMessage[];
  feedback: TicketFeedback | null;
  attachments?: Attachment[];
};

const API_BASE = getApiBase();

function AttachmentBadge({ attachment, ticketId }: { attachment: Attachment; ticketId: string }) {
  const isImage = attachment.mimeType?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".svg", ".gif"].some(ext => attachment.fileName.toLowerCase().endsWith(ext));
  const downloadUrl = `${API_BASE}/tickets/${ticketId}/attachments/${attachment.id}/download`;

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-black/10 bg-canvas/50 hover:bg-canvas/90 hover:border-black/20 transition-all text-left text-ink max-w-[200px]"
      title={`Download ${attachment.fileName}`}
    >
      {isImage ? (
        <div className="size-8 rounded bg-surface border border-black/5 flex items-center justify-center overflow-hidden shrink-0">
          <img
            src={downloadUrl}
            alt={attachment.fileName}
            className="size-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="size-8 rounded bg-surface border border-black/5 flex items-center justify-center shrink-0">
          <FileText className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-medium truncate font-mono">{attachment.fileName}</p>
        <p className="text-[8px] text-muted-foreground font-mono">{(attachment.fileSize / 1024).toFixed(1)} KB</p>
      </div>
    </a>
  );
}

export default function ClientPortal() {
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Sync selected ticket ID with URL query params
  useEffect(() => {
    const handleSync = () => {
      const params = new URLSearchParams(window.location.search);
      const ticketId = params.get("ticket");
      if (ticketId) {
        setSelectedTicketId(ticketId);
      }
    };
    handleSync();
    window.addEventListener("popstate", handleSync);
    return () => window.removeEventListener("popstate", handleSync);
  }, []);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Search & Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Submit Ticket Form states
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [workstream, setWorkstream] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTicketAttachments, setNewTicketAttachments] = useState<Attachment[]>([]);
  const [isNewTicketUploading, setIsNewTicketUploading] = useState(false);

  const handleUploadNewTicketFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setIsNewTicketUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`${API_BASE}/uploads/attachment`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
        }
        const data = await res.json();
        setNewTicketAttachments(prev => [...prev, data]);
      } catch (err: any) {
        console.error("File upload failed:", err);
        alert(`Failed to upload "${file.name}": ${err.message}`);
      }
    }
    setIsNewTicketUploading(false);
    e.target.value = "";
  };

  // Message Composer state
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [isReplyUploading, setIsReplyUploading] = useState(false);

  const handleUploadReplyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setIsReplyUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`${API_BASE}/uploads/attachment`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
        }
        const data = await res.json();
        setReplyAttachments(prev => [...prev, data]);
      } catch (err: any) {
        console.error("File upload failed:", err);
        alert(`Failed to upload "${file.name}": ${err.message}`);
      }
    }
    setIsReplyUploading(false);
    e.target.value = "";
  };

  // CSAT Rating states
  const [csatRating, setCsatRating] = useState<number>(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatError, setCsatError] = useState<string | null>(null);

  // =========================================================================
  // 1. Data Fetching
  // =========================================================================

  // Fetch client's ticket directory list
  const { data: ticketsList = [], isLoading: loadingList } = useQuery<Ticket[]>({
    queryKey: ["client_tickets", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`${API_BASE}/tickets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  // Fetch details & conversation thread for the selected ticket
  const { data: ticketDetails, isLoading: loadingDetails } = useQuery<TicketDetails>({
    queryKey: ["client_ticket_detail", selectedTicketId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ticket conversation details");
      return res.json();
    },
    enabled: !!selectedTicketId,
  });

  // =========================================================================
  // 2. Mutation Hooks
  // =========================================================================

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit support request");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client_tickets"] });
      setSubject("");
      setDescription("");
      setPriority("normal");
      setWorkstream("");
      setCreateError(null);
      setNewTicketAttachments([]);
      setIsSubmitModalOpen(false);
      // Directly open newly created ticket details
      setSelectedTicketId(data.id);
    },
    onError: (err: any) => {
      setCreateError(err.message);
    },
  });

  // Post message reply mutation
  const postReplyMutation = useMutation({
    mutationFn: async (payload: { body: string; attachments?: Attachment[] }) => {
      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: payload.body, isInternal: false, attachments: payload.attachments }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post reply message");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_ticket_detail", selectedTicketId] });
      setReplyBody("");
      setReplyAttachments([]);
    },
  });

  // Submit CSAT feedback rating mutation
  const submitFeedbackMutation = useMutation({
    mutationFn: async (payload: { rating: number; comment: string }) => {
      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit customer satisfaction rating");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_ticket_detail", selectedTicketId] });
      setCsatRating(0);
      setCsatComment("");
      setCsatError(null);
    },
    onError: (err: any) => {
      setCsatError(err.message);
    },
  });

  // =========================================================================
  // 3. Form Submit Handlers
  // =========================================================================

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    createTicketMutation.mutate({
      subject,
      description,
      priority,
      workstream: workstream || null,
      attachments: newTicketAttachments,
    });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() && replyAttachments.length === 0) return;
    postReplyMutation.mutate({
      body: replyBody,
      attachments: replyAttachments,
    });
  };

  const handleSubmitCSAT = (e: React.FormEvent) => {
    e.preventDefault();
    if (csatRating === 0) {
      setCsatError("Please select a star rating level");
      return;
    }
    submitFeedbackMutation.mutate({
      rating: csatRating,
      comment: csatComment,
    });
  };

  // =========================================================================
  // 4. Utility Render Helpers
  // =========================================================================

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "new":
        return "bg-sky-500/10 text-sky-600 border-sky-500/20";
      case "open":
        return "bg-success/15 text-success border-success/30";
      case "pending":
        return "bg-warning/15 text-warning border-warning/30";
      case "resolved":
        return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
      case "closed":
        return "bg-black/5 text-muted-foreground border-black/5";
      default:
        return "bg-black/5 text-muted-foreground border-black/5";
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "low":
        return "bg-black/5 text-muted-foreground";
      case "normal":
        return "bg-black/5 text-ink";
      case "high":
        return "bg-warning/10 text-warning";
      case "urgent":
        return "bg-danger/10 text-danger font-bold";
      default:
        return "bg-black/5 text-ink";
    }
  };

  // =========================================================================
  // 5. Render Detail View (TIMELINE & MESSAGES)
  // =========================================================================

  if (selectedTicketId) {
    return (
      <div className="w-full px-6 md:px-12 py-10 font-sans text-ink max-w-4xl mx-auto">
        {/* Back navigation */}
        <button
          onClick={() => {
            setSelectedTicketId(null);
            const url = new URL(window.location.href);
            url.searchParams.delete("ticket");
            window.history.pushState({}, "", url.pathname + url.search + url.hash);
          }}
          className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Ticket Requests
        </button>

        {loadingDetails || !ticketDetails ? (
          <div className="text-center text-xs text-muted-foreground py-20 font-mono">
            Loading request details…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Ticket Summary Card */}
            <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Request #{ticketDetails.code}
                  </span>
                  <h1 className="font-serif text-3xl mt-1">{ticketDetails.subject}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getStatusStyle(ticketDetails.status)}`}>
                    {ticketDetails.status}
                  </span>
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${getPriorityStyle(ticketDetails.priority)}`}>
                    {ticketDetails.priority} priority
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-3 leading-relaxed text-muted-foreground">
                <div>
                  <span className="font-semibold block text-ink mb-1">Issue Description:</span>
                  <p className="bg-surface/5 p-4 rounded-xl border border-black/5 text-ink whitespace-pre-wrap">
                    {ticketDetails.description}
                  </p>
                  {ticketDetails.attachments && ticketDetails.attachments.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-black/5">
                      <span className="text-[10px] font-semibold text-ink block mb-2">Attachments ({ticketDetails.attachments.length})</span>
                      <div className="flex flex-wrap gap-2">
                        {ticketDetails.attachments.map((att) => (
                          <AttachmentBadge key={att.id} attachment={att} ticketId={ticketDetails.id} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 text-[10px] font-mono uppercase tracking-wide">
                  <div>
                    <span className="text-muted-foreground">Submitted:</span>{" "}
                    <span className="text-ink font-semibold">{new Date(ticketDetails.createdAt).toLocaleString()}</span>
                  </div>
                  {ticketDetails.workstream && (
                    <div>
                      <span className="text-muted-foreground">Category:</span>{" "}
                      <span className="text-ink font-semibold">{ticketDetails.workstream}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Conversation Thread Messages */}
            <div className="space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MessageSquare className="size-3.5" />
                Conversation History
              </h2>

              <div className="space-y-4">
                {ticketDetails.messages.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-black/10 rounded-2xl bg-surface/10 text-xs text-muted-foreground font-mono">
                    No replies yet. Our support agents will respond shortly.
                  </div>
                ) : (
                  ticketDetails.messages.map((msg) => {
                    const isClient = msg.senderRole === "client";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${isClient ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                      >
                        {/* Avatar */}
                        <div className="size-8 rounded-full bg-surface border border-black/5 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                          {msg.sender.initials}
                        </div>

                        {/* Speech Bubble */}
                        <div className="space-y-1">
                          <div className={`text-[10px] text-muted-foreground font-mono flex items-center gap-2 ${isClient ? "justify-end" : ""}`}>
                            <span className="text-ink font-semibold">
                              {msg.sender.firstName} {msg.sender.lastName}
                            </span>
                            <span>•</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div
                            className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                              isClient
                                  ? "bg-brand-primary text-brand-secondary border-brand-primary rounded-tr-none"
                                : "bg-canvas text-ink border-black/10 rounded-tl-none shadow-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`mt-3 pt-3 border-t ${isClient ? "border-brand-secondary/20" : "border-black/5"}`}>
                                <div className="flex flex-wrap gap-2">
                                  {msg.attachments.map((att) => (
                                    <AttachmentBadge key={att.id} attachment={att} ticketId={ticketDetails.id} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reply Composer (Disabled if Ticket is Closed) */}
            {ticketDetails.status !== "closed" ? (
              <form onSubmit={handleSendReply} className="border border-black/10 rounded-2xl bg-canvas p-4 shadow-sm flex flex-col gap-2">
                {/* Queued files display */}
                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2 border-b border-black/5 bg-surface/30 rounded-t-xl">
                    {replyAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas border border-black/10 text-[10px] font-mono">
                        <FileText className="size-3 text-muted-foreground" />
                        <span className="max-w-[120px] truncate" title={file.fileName}>{file.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-ink shrink-0"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Send a response
                  </span>
                  <textarea
                    rows={3}
                    required={replyAttachments.length === 0}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full bg-surface ring-1 ring-black/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                  />
                </label>
                
                <div className="flex items-center justify-between mt-1">
                  <label className="size-8 rounded-xl flex items-center justify-center hover:bg-surface active:scale-95 cursor-pointer transition-all">
                    <input
                      type="file"
                      multiple
                      onChange={handleUploadReplyFile}
                      disabled={isReplyUploading}
                      className="hidden"
                    />
                    <Paperclip className={`size-4.5 ${isReplyUploading ? "animate-pulse text-muted-foreground" : "text-muted-foreground hover:text-ink"}`} />
                  </label>

                  <button
                    type="submit"
                    disabled={postReplyMutation.isPending || (!replyBody.trim() && replyAttachments.length === 0)}
                    className="bg-brand-primary text-brand-secondary text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    <Send className="size-3.5" />
                    {postReplyMutation.isPending ? "Sending reply…" : "Send Message"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="border border-black/10 rounded-2xl bg-black/[0.02] p-4 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
                <Lock className="size-4" />
                This ticket has been closed. Reopen by submitting a reply if you require further assistance.
              </div>
            )}

            {/* CSAT Customer Satisfaction Rating Section */}
            {(ticketDetails.status === "resolved" || ticketDetails.status === "closed") && (
              <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
                <h3 className="font-serif text-xl mb-1">How did we do?</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Please rate your support experience for this request.
                </p>

                {ticketDetails.feedback ? (
                  <div className="p-4 bg-success/5 border border-success/15 rounded-xl text-xs flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-4 ${
                              star <= ticketDetails.feedback!.rating ? "text-warning fill-warning" : "text-black/10"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold block text-ink">Feedback submitted:</span>
                      <p className="text-muted-foreground mt-1 italic">
                        "{ticketDetails.feedback!.comment || "No comment provided."}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitCSAT} className="space-y-4">
                    {csatError && (
                      <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                        <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                        <span>{csatError}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            setCsatRating(star);
                            setCsatError(null);
                          }}
                          className="hover:scale-110 active:scale-95 transition-transform"
                        >
                          <Star
                            className={`size-8 ${
                              star <= csatRating ? "text-warning fill-warning" : "text-black/10 hover:text-warning/50"
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <label className="block text-left">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                        Optional Comment
                      </span>
                      <textarea
                        rows={2}
                        value={csatComment}
                        onChange={(e) => setCsatComment(e.target.value)}
                        placeholder="Share any additional feedback..."
                        className="w-full bg-surface ring-1 ring-black/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitFeedbackMutation.isPending}
                      className="bg-brand-primary text-brand-secondary py-2 px-4 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {submitFeedbackMutation.isPending ? "Submitting CSAT..." : "Submit Experience Feedback"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 6. Render Directory List View
  // =========================================================================

  return (
    <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
      {/* Title Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Customer Help Center
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            How can we help you?
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[60ch] leading-relaxed">
            Submit a new technical case or track the resolution status of requests submitted by your company context.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm self-start"
        >
          <Plus className="size-4" />
          Create Support Request
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="flex-1 w-full">
          <input
            type="text"
            placeholder="Search requests by keyword or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-canvas ring-1 ring-black/10 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48 bg-canvas ring-1 ring-black/10 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-black/20 transition-all shrink-0"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Directory list of tickets */}
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6">
          Your Open Support Requests
        </h2>

        {loadingList ? (
          <div className="text-xs text-muted-foreground py-10 text-center font-mono">
            Loading support cases…
          </div>
        ) : ticketsList.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-xl bg-surface/30">
            No active support tickets found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/10 text-muted-foreground uppercase font-mono tracking-wider text-[10px]">
                  <th className="pb-3 pl-2 w-20">Code</th>
                  <th className="pb-3">Subject</th>
                  <th className="pb-3 w-32">Category</th>
                  <th className="pb-3 w-28">Status</th>
                  <th className="pb-3 w-28">Priority</th>
                  <th className="pb-3 w-32">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {ticketsList.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => {
                      setSelectedTicketId(t.id);
                      const url = new URL(window.location.href);
                      url.searchParams.set("ticket", t.id);
                      window.history.pushState({}, "", url.pathname + url.search + url.hash);
                    }}
                    className="hover:bg-surface/5 cursor-pointer transition-colors"
                  >
                    <td className="py-4 pl-2 font-mono text-[10px] font-bold text-muted-foreground">
                      #{t.code}
                    </td>
                    <td className="py-4 font-serif text-sm font-semibold text-ink pr-4">
                      {t.subject}
                    </td>
                    <td className="py-4 text-muted-foreground font-mono text-[10px]">
                      {t.workstream || "General"}
                    </td>
                    <td className="py-4">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${getStatusStyle(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${getPriorityStyle(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-4 text-muted-foreground text-[10px] font-mono">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Submission Overlay Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsSubmitModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>

            <h2 className="text-xl font-serif mb-1">Create Support Request</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Detail your technical issue. Our automated triage routing will prioritize your case.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Subject / Summary
                </span>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Cannot log in to the Maison API dashboard"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Description / Full Details
                </span>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe steps to reproduce and any error messages..."
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Priority Severity
                  </span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                  >
                    <option value="low">Low (General Inquiry)</option>
                    <option value="normal">Normal (Standard Issue)</option>
                    <option value="high">High (Service Impaired)</option>
                    <option value="urgent">Urgent (Production Down)</option>
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Workstream / Category
                  </span>
                  <input
                    type="text"
                    value={workstream}
                    onChange={(e) => setWorkstream(e.target.value)}
                    placeholder="e.g. billing, API"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>
              </div>

              {/* Drag and Drop File Uploader Zone */}
              <div className="space-y-2 text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                  Attachments (Max 5MB)
                </span>
                
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (!e.dataTransfer.files) return;
                    const files = Array.from(e.dataTransfer.files);
                    setIsNewTicketUploading(true);
                    for (const file of files) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert(`File "${file.name}" exceeds the 5MB size limit.`);
                        continue;
                      }
                      const formData = new FormData();
                      formData.append("file", file);
                      try {
                        const res = await fetch(`${API_BASE}/uploads/attachment`, {
                          method: "POST",
                          body: formData,
                          credentials: "include",
                        });
                        if (!res.ok) {
                          const errData = await res.json();
                          throw new Error(errData.error || "Upload failed");
                        }
                        const data = await res.json();
                        setNewTicketAttachments(prev => [...prev, data]);
                      } catch (err: any) {
                        console.error("File upload failed:", err);
                        alert(`Failed to upload "${file.name}": ${err.message}`);
                      }
                    }
                    setIsNewTicketUploading(false);
                  }}
                  className="border-2 border-dashed border-black/10 hover:border-black/20 rounded-xl p-4 transition-all bg-surface/30 flex flex-col items-center justify-center cursor-pointer text-center relative"
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleUploadNewTicketFile}
                    disabled={isNewTicketUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className={`size-6 text-muted-foreground mb-1.5 ${isNewTicketUploading ? "animate-bounce" : ""}`} />
                  <p className="text-[11px] font-medium text-ink">
                    {isNewTicketUploading ? "Uploading files..." : "Drag & drop files here, or click to browse"}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                    PNG, JPG, PDF, DOCX, TXT, CSV, ZIP up to 5MB
                  </p>
                </div>

                {/* List of uploaded files */}
                {newTicketAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {newTicketAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas border border-black/10 text-[10px] font-mono">
                        <FileText className="size-3 text-muted-foreground" />
                        <span className="max-w-[120px] truncate" title={file.fileName}>{file.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setNewTicketAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-ink shrink-0"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={createTicketMutation.isPending}
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-4"
              >
                {createTicketMutation.isPending ? "Submitting request…" : "Submit Support Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
