import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { useAuth } from "../hooks/useAuth";
import {
  Search,
  Send,
  Merge,
  Clock,
  ShieldAlert,
  HelpCircle,
  Star,
  X,
  Paperclip,
  FileText,
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
  clientId: string;
  assigneeId: string | null;
  teamId: string | null;
  slaState: "on-track" | "at-risk" | "breached";
  slaResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientName: string;
  assignee: {
    firstName: string;
    lastName: string;
    initials: string;
  } | null;
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

type AuditLog = {
  id: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: {
    firstName: string;
    lastName: string;
    initials: string;
  } | null;
};

type TicketFeedback = {
  id: string;
  rating: number;
  comment: string | null;
};

type TicketDetails = Ticket & {
  messages: TicketMessage[];
  auditLogs: AuditLog[];
  feedback: TicketFeedback | null;
  teamName: string | null;
  requester: {
    firstName: string;
    lastName: string;
    email: string;
  };
  attachments?: Attachment[];
};

type SupportTeam = {
  id: string;
  name: string;
};

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
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

export default function Inbox() {
  const { user } = useAuth();
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

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [queueTab, setQueueTab] = useState<"all" | "mine" | "unassigned" | "priority">("all");

  // Reply Composer states
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [composerBody, setComposerBody] = useState("");
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    setIsUploading(true);
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
        setUploadedAttachments(prev => [...prev, data]);
      } catch (error: any) {
        console.error("File upload failed:", error);
        alert(`Failed to upload "${file.name}": ${error.message}`);
      }
    }
    setIsUploading(false);
    e.target.value = "";
  };

  // Merge tool state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeChildCode, setMergeChildCode] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Sidebar dynamic updates
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editWorkstream, setEditWorkstream] = useState("");

  // =========================================================================
  // 1. Data Fetching
  // =========================================================================

  // Fetch tickets queue
  const { data: ticketsQueue = [], isLoading: loadingQueue } = useQuery<Ticket[]>({
    queryKey: ["agent_tickets_queue", search],
    queryFn: async (): Promise<Ticket[]> => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      const res = await fetch(`${API_BASE}/tickets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  // Fetch ticket details
  const { data: ticketDetails, isLoading: loadingDetails } = useQuery<TicketDetails>({
    queryKey: ["agent_ticket_detail", selectedTicketId],
    queryFn: async (): Promise<TicketDetails> => {
      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ticket conversation details");
      return res.json();
    },
    enabled: !!selectedTicketId,
  });

  // Synchronize sidebar state when ticket details load
  useEffect(() => {
    if (ticketDetails) {
      setEditStatus(ticketDetails.status);
      setEditPriority(ticketDetails.priority);
      setEditTeamId(ticketDetails.teamId || "");
      setEditAssigneeId(ticketDetails.assigneeId || "");
      setEditWorkstream(ticketDetails.workstream || "");
    }
  }, [ticketDetails]);

  // Fetch teams list (for properties assign dropdown)
  const { data: teamsList = [] } = useQuery<SupportTeam[]>({
    queryKey: ["teams_assign_list"],
    queryFn: async (): Promise<SupportTeam[]> => {
      const res = await fetch(`${API_BASE}/teams`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch staff list (for properties assign dropdown)
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff_assign_list"],
    queryFn: async (): Promise<StaffMember[]> => {
      const res = await fetch(`${API_BASE}/staff`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // =========================================================================
  // 2. Filter Queue Logic
  // =========================================================================

  const filteredQueue = ticketsQueue.filter((t) => {
    if (queueTab === "mine") {
      return t.assigneeId === user?.id;
    }
    if (queueTab === "unassigned") {
      return !t.assigneeId;
    }
    if (queueTab === "priority") {
      return t.priority === "high" || t.priority === "urgent";
    }
    return true;
  });

  // =========================================================================
  // 3. Mutation Hooks
  // =========================================================================

  // Post message response mutation (Reply or Note)
  const postMsgMutation = useMutation({
    mutationFn: async (payload: { body: string; isInternal: boolean; attachments?: Attachment[] }) => {
      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post message response");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_ticket_detail", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["agent_tickets_queue"] });
      setComposerBody("");
      setUploadedAttachments([]);
    },
  });

  // Update properties mutation
  const updatePropsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update ticket properties");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_ticket_detail", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["agent_tickets_queue"] });
    },
  });

  // Merge tickets mutation
  const mergeTicketsMutation = useMutation({
    mutationFn: async (payload: { parentTicketId: string; childTicketId: string }) => {
      const res = await fetch(`${API_BASE}/tickets/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to merge ticket");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_ticket_detail", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["agent_tickets_queue"] });
      setMergeChildCode("");
      setMergeError(null);
      setIsMergeModalOpen(false);
    },
    onError: (err: any) => {
      setMergeError(err.message);
    },
  });

  // =========================================================================
  // 4. Form Submit Handlers
  // =========================================================================

  const handleSendComposer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerBody.trim()) return;
    postMsgMutation.mutate({
      body: composerBody,
      isInternal: composerTab === "note",
      attachments: uploadedAttachments,
    });
  };

  const handleUpdateProps = (field: string, val: any) => {
    const payload: any = {};
    payload[field] = val;
    updatePropsMutation.mutate(payload);
  };

  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeChildCode.trim()) return;

    // Find the child ticket object in the queue to get its uuid ID reference
    const childNum = parseInt(mergeChildCode, 10);
    const childTicket = ticketsQueue.find((t) => t.code === childNum);

    if (!childTicket) {
      setMergeError(`Duplicate ticket #${mergeChildCode} not found in active list`);
      return;
    }

    mergeTicketsMutation.mutate({
      parentTicketId: selectedTicketId!,
      childTicketId: childTicket.id,
    });
  };

  // =========================================================================
  // 5. Utility Render Helpers
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
        return "bg-black/5 text-muted-foreground border-black/5";
      case "normal":
        return "bg-black/5 text-ink border-black/10";
      case "high":
        return "bg-warning/10 text-warning border-warning/20";
      case "urgent":
        return "bg-danger/10 text-danger border-danger/20 font-bold";
      default:
        return "bg-black/5 text-ink";
    }
  };

  const formatAuditAction = (log: AuditLog) => {
    const actorName = log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System Routing Engine";
    
    switch (log.action) {
      case "create":
        return `${actorName} created the ticket request`;
      case "auto_assignment":
        const autoVal = JSON.parse(log.newValue || "{}");
        return `System Auto-Routing engine matching rule '${autoVal.ruleName}' assigned this ticket`;
      case "status_change":
        return `${actorName} changed status from '${log.previousValue}' to '${log.newValue}'`;
      case "priority_change":
        return `${actorName} changed priority level to '${log.newValue}'`;
      case "assignment_change":
        return `${actorName} changed assignee assignment to ${log.newValue}`;
      case "team_change":
        return `${actorName} re-routed team to ${log.newValue}`;
      case "merge_parent":
        const mergeVal = JSON.parse(log.newValue || "{}");
        return `${actorName} merged duplicate ticket #${mergeVal.childCode} into this thread`;
      case "merge_child":
        const childVal = JSON.parse(log.newValue || "{}");
        return `Ticket closed and merged into parent ticket #${childVal.parentCode}`;
      case "csat_feedback":
        const csat = JSON.parse(log.newValue || "{}");
        return `Client submitted CSAT score of ${csat.rating}/5 stars`;
      default:
        return `${actorName} performed action '${log.action}'`;
    }
  };

  // =========================================================================
  // Main Render (SPLIT-PANEL LAYOUT)
  // =========================================================================

  return (
    <div className="flex h-[calc(100vh-3.5rem)] divide-x divide-black/10 text-ink bg-canvas overflow-hidden">
      
      {/* =====================================================================
          PANEL 1: TICKET QUEUE COLUMN (350px)
          ===================================================================== */}
      <div className="w-[380px] flex flex-col shrink-0 bg-canvas">
        {/* Search */}
        <div className="p-4 border-b border-black/10">
          <div className="flex items-center bg-surface ring-1 ring-black/10 rounded-lg overflow-hidden focus-within:ring-black/20 transition-all">
            <Search className="size-4 text-muted-foreground ml-3 shrink-0" />
            <input
              type="text"
              placeholder="Search by code, subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Filters Tabs */}
        <div className="grid grid-cols-4 border-b border-black/10 bg-surface/20 text-[10px] font-mono uppercase tracking-wider text-center">
          <button
            onClick={() => setQueueTab("all")}
            className={`py-2.5 font-bold ${queueTab === "all" ? "border-b-2 border-ink text-ink bg-canvas" : "text-muted-foreground hover:text-ink"}`}
          >
            All
          </button>
          <button
            onClick={() => setQueueTab("mine")}
            className={`py-2.5 font-bold ${queueTab === "mine" ? "border-b-2 border-ink text-ink bg-canvas" : "text-muted-foreground hover:text-ink"}`}
          >
            Mine
          </button>
          <button
            onClick={() => setQueueTab("unassigned")}
            className={`py-2.5 font-bold ${queueTab === "unassigned" ? "border-b-2 border-ink text-ink bg-canvas" : "text-muted-foreground hover:text-ink"}`}
          >
            Unassigned
          </button>
          <button
            onClick={() => setQueueTab("priority")}
            className={`py-2.5 font-bold ${queueTab === "priority" ? "border-b-2 border-ink text-ink bg-canvas" : "text-muted-foreground hover:text-ink"}`}
          >
            Priority
          </button>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/5">
          {loadingQueue ? (
            <div className="text-center text-xs text-muted-foreground py-10 font-mono">Loading queue…</div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12 px-6">
              No tickets found in this tab.
            </div>
          ) : (
            filteredQueue.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => {
                  setSelectedTicketId(ticket.id);
                  const url = new URL(window.location.href);
                  url.searchParams.set("ticket", ticket.id);
                  window.history.pushState({}, "", url.pathname + url.search + url.hash);
                }}
                className={`p-4 cursor-pointer text-left transition-colors relative ${
                  selectedTicketId === ticket.id ? "bg-surface" : "hover:bg-surface/40"
                }`}
              >
                {/* Active Indicator bar */}
                {selectedTicketId === ticket.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary" />
                )}

                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-[9px] font-bold text-muted-foreground">
                    #{ticket.code}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-serif text-sm font-semibold line-clamp-1 mb-1 text-ink">
                  {ticket.subject}
                </h3>
                
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                  {ticket.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] font-semibold text-ink/75 truncate max-w-[140px]">
                    {ticket.clientName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${getStatusStyle(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${getPriorityStyle(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* =====================================================================
          PANEL 2: CONVERSATION TIMELINE COLUMN (FLEX-1)
          ===================================================================== */}
      <div className="flex-1 flex flex-col bg-canvas min-w-0">
        {!selectedTicketId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
            <HelpCircle className="size-10 stroke-[1.2] mb-3 text-muted-foreground/50" />
            <h3 className="font-serif text-lg text-ink">No Ticket Selected</h3>
            <p className="text-xs max-w-[35ch] text-center mt-1 leading-relaxed">
              Select a technical ticket request from the left queue directory to review details, logs, and compose message responses.
            </p>
          </div>
        ) : loadingDetails || !ticketDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-muted-foreground font-mono">
            Loading support thread details…
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="py-3 px-5 border-b border-black/10 bg-canvas flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase bg-black/[0.04] px-1.5 py-0.5 rounded text-muted-foreground">
                    #{ticketDetails.code}
                  </span>
                  <h1 className="font-serif text-lg font-bold text-ink truncate" title={ticketDetails.subject}>
                    {ticketDetails.subject}
                  </h1>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground font-mono">
                  <span>Client: <strong className="text-ink">{ticketDetails.clientName}</strong></span>
                  <span>•</span>
                  <span>Requester: <strong className="text-ink">{ticketDetails.requester.firstName} {ticketDetails.requester.lastName}</strong></span>
                </div>
              </div>

              {/* Compact SLA status */}
              <div className="flex flex-col items-end text-right shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                    SLA Status:
                  </span>
                  <div className="flex items-center gap-1 bg-surface px-2 py-0.5 rounded-full border border-black/5">
                    <span className={`size-1.5 rounded-full ${
                      ticketDetails.slaState === "on-track" ? "bg-success" : ticketDetails.slaState === "at-risk" ? "bg-warning" : "bg-danger"
                    }`} />
                    <span className="text-[9px] font-bold uppercase font-mono">
                      {ticketDetails.slaState}
                    </span>
                  </div>
                </div>
                {ticketDetails.status !== "resolved" && ticketDetails.status !== "closed" && ticketDetails.slaResolutionDueAt && (
                  <span className="text-[8px] text-muted-foreground font-mono mt-0.5">
                    Due: {new Date(ticketDetails.slaResolutionDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable Chat and Audit Timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface/5">
              {/* Primary ticket description */}
              <div className="border border-black/10 rounded-xl bg-canvas p-4 shadow-sm text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Original Request Body
                </span>
                <p className="text-xs leading-relaxed text-ink whitespace-pre-wrap">
                  {ticketDetails.description}
                </p>
                {ticketDetails.attachments && ticketDetails.attachments.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-black/5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                      Attachments ({ticketDetails.attachments.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {ticketDetails.attachments.map((att) => (
                        <AttachmentBadge key={att.id} attachment={att} ticketId={ticketDetails.id} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Messaging Timeline items */}
              <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-black/5">
                {ticketDetails.messages.map((msg) => {
                  const isAgent = msg.senderRole === "agent";
                  return (
                    <div key={msg.id} className="flex gap-4 relative">
                      {/* Avatar */}
                      <div className={`size-8 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 border z-10 ${
                        msg.isInternal 
                          ? "bg-warning/20 border-warning/30 text-warning" 
                          : isAgent 
                            ? "bg-brand-primary text-brand-secondary border-brand-primary" 
                            : "bg-surface border-black/5"
                      }`}>
                        {msg.sender.initials}
                      </div>

                      <div className="space-y-1 text-left flex-1 min-w-0">
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                          <span className="text-ink font-semibold">
                            {msg.sender.firstName} {msg.sender.lastName}
                          </span>
                          <span className="bg-black/5 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                            {msg.senderRole}
                          </span>
                          {msg.isInternal && (
                            <span className="bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">
                              Internal Note
                            </span>
                          )}
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>

                        <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                          msg.isInternal 
                            ? "bg-warning/5 border-warning/15 text-warning-ink rounded-tl-none" 
                            : "bg-canvas text-ink border-black/10 rounded-tl-none shadow-sm"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-black/5">
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
                })}

                {/* Audit Logs events items */}
                {ticketDetails.auditLogs.map((log) => (
                  <div key={log.id} className="flex gap-4 items-center pl-2 py-1 text-left">
                    <div className="size-4 rounded-full bg-black/5 border border-black/5 flex items-center justify-center shrink-0 z-10">
                      <Clock className="size-2 text-muted-foreground" />
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                      <span>{formatAuditAction(log)}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Composer Footer Form */}
            <div className="p-3 border-t border-black/10 bg-canvas">
              {ticketDetails.status !== "closed" ? (
                <form onSubmit={handleSendComposer} className="flex flex-col gap-2">
                  {/* Compact Toggle Tab */}
                  <div className="flex gap-2 text-[10px] font-mono uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setComposerTab("reply")}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${
                        composerTab === "reply"
                          ? "bg-brand-primary text-brand-secondary shadow-sm"
                          : "bg-surface text-muted-foreground hover:text-ink"
                      }`}
                    >
                      Public Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerTab("note")}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${
                        composerTab === "note"
                          ? "bg-warning/20 text-warning border border-warning/30 shadow-sm"
                          : "bg-surface text-muted-foreground hover:text-ink"
                      }`}
                    >
                      Internal Note
                    </button>
                  </div>

                  {/* Queued files display */}
                  {uploadedAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 border-b border-black/5 bg-surface/30 rounded-t-xl">
                      {uploadedAttachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas border border-black/10 text-[10px] font-mono">
                          <FileText className="size-3 text-muted-foreground" />
                          <span className="max-w-[120px] truncate" title={file.fileName}>{file.fileName}</span>
                          <button
                            type="button"
                            onClick={() => setUploadedAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-ink shrink-0"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input Bar Layout (WhatsApp style) */}
                  <div className={`flex items-end gap-2 p-1.5 rounded-2xl border transition-all ${
                    uploadedAttachments.length > 0 ? "rounded-t-none border-t-0" : ""
                  } ${
                    composerTab === "note"
                      ? "bg-warning/[0.02] border-warning/30 focus-within:border-warning"
                      : "bg-canvas border-black/10 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20"
                  }`}>
                    <label className="size-8 rounded-xl flex items-center justify-center shrink-0 hover:bg-surface active:scale-95 cursor-pointer transition-all">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <Paperclip className={`size-4 ${isUploading ? "animate-pulse text-muted-foreground" : "text-muted-foreground hover:text-ink"}`} />
                    </label>
                    <textarea
                      rows={1}
                      required={uploadedAttachments.length === 0}
                      value={composerBody}
                      onChange={(e) => setComposerBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if ((composerBody.trim() || uploadedAttachments.length > 0) && !postMsgMutation.isPending) {
                            handleSendComposer(e as any);
                          }
                        }
                      }}
                      placeholder={
                        composerTab === "note"
                          ? "Type internal note..."
                          : "Type your response..."
                      }
                      className="flex-1 bg-transparent text-xs px-2 py-1.5 focus:outline-none resize-none leading-normal max-h-24 overflow-y-auto"
                      style={{ height: "32px" }}
                    />
                    <button
                      type="submit"
                      disabled={postMsgMutation.isPending || (!composerBody.trim() && uploadedAttachments.length === 0)}
                      className={`size-8 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40 shadow-sm ${
                        composerTab === "note"
                          ? "bg-warning text-white hover:opacity-90"
                          : "bg-brand-primary text-brand-secondary hover:opacity-95"
                      }`}
                      title={composerTab === "note" ? "Post Internal Note" : "Send Response"}
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 border border-dashed border-black/10 rounded-xl bg-black/[0.01] text-center text-xs text-muted-foreground font-mono">
                  This ticket has been closed. Change status in the sidebar details panel to open and compose messages.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* =====================================================================
          PANEL 3: TICKET METADATA SIDEBAR (280px)
          ===================================================================== */}
      {selectedTicketId && ticketDetails && (
        <div className="w-[300px] shrink-0 bg-canvas flex flex-col overflow-y-auto p-6 space-y-6 text-left">
          
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Ticket Properties
            </h2>

            {/* Status Dropdown */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Ticket Status
                </span>
                <select
                  value={editStatus}
                  onChange={(e) => {
                    setEditStatus(e.target.value);
                    handleUpdateProps("status", e.target.value);
                  }}
                  className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                >
                  <option value="new">New</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </label>

              {/* Priority Dropdown */}
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Priority
                </span>
                <select
                  value={editPriority}
                  onChange={(e) => {
                    setEditPriority(e.target.value);
                    handleUpdateProps("priority", e.target.value);
                  }}
                  className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority</option>
                </select>
              </label>

              {/* Support Team assignment */}
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Assigned Team
                </span>
                <select
                  value={editTeamId}
                  onChange={(e) => {
                    setEditTeamId(e.target.value);
                    handleUpdateProps("teamId", e.target.value || null);
                  }}
                  className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                >
                  <option value="">Unassigned</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Staff Agent assignment */}
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Assignee Agent
                </span>
                <select
                  value={editAssigneeId}
                  onChange={(e) => {
                    setEditAssigneeId(e.target.value);
                    handleUpdateProps("assigneeId", e.target.value || null);
                  }}
                  className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.firstName} {agent.lastName}
                    </option>
                  ))}
                </select>
              </label>

              {/* Workstream/Category input */}
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Workstream / Category
                </span>
                <input
                  type="text"
                  value={editWorkstream}
                  onChange={(e) => setEditWorkstream(e.target.value)}
                  onBlur={() => handleUpdateProps("workstream", editWorkstream || null)}
                  placeholder="e.g. billing, setup"
                  className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                />
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-black/10">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Agent Actions
            </h2>

            {/* Merge Duplicate Tickets */}
            <button
              onClick={() => setIsMergeModalOpen(true)}
              className="w-full border border-black/15 bg-canvas hover:bg-surface text-ink text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
            >
              <Merge className="size-3.5" />
              Merge Duplicate Cases
            </button>
          </div>

          {/* Render CSAT Feedback detail (if has csat feedback) */}
          {ticketDetails.feedback && (
            <div className="pt-6 border-t border-black/10 text-left">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                Client CSAT Score
              </span>
              <div className="bg-success/5 border border-success/15 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`size-3.5 ${
                        star <= ticketDetails.feedback!.rating ? "text-warning fill-warning" : "text-black/10"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-ink block">Customer comment:</span>
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  "{ticketDetails.feedback!.comment || "No comment left."}"
                </p>
              </div>
            </div>
          )}

          {/* Merge overlay popup */}
          {isMergeModalOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 text-left">
                <button
                  onClick={() => {
                    setIsMergeModalOpen(false);
                    setMergeError(null);
                  }}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
                >
                  <X className="size-4" />
                </button>

                <h3 className="text-base font-serif mb-1">Merge Duplicate Ticket</h3>
                <p className="text-xs text-muted-foreground mb-6">
                  Close a duplicate ticket and merge its entire messaging history into the current ticket: <strong>#{ticketDetails.code}</strong>.
                </p>

                {mergeError && (
                  <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    <span>{mergeError}</span>
                  </div>
                )}

                <form onSubmit={handleMergeSubmit} className="space-y-4">
                  <label className="block">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                      Duplicate Ticket Code
                    </span>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 102"
                      value={mergeChildCode}
                      onChange={(e) => setMergeChildCode(e.target.value)}
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={mergeTicketsMutation.isPending || !mergeChildCode}
                    className="w-full bg-brand-primary text-brand-secondary py-2 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-1"
                  >
                    <Merge className="size-3.5" />
                    {mergeTicketsMutation.isPending ? "Merging..." : "Merge Duplicate Ticket"}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
