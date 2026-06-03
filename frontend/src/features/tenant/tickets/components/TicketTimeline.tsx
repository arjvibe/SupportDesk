import { useState } from "react";
import { Clock } from "lucide-react";
import type { TicketDetails, Attachment } from "../types";
import { AttachmentBadge } from "./AttachmentBadge";

interface TicketTimelineProps {
  ticketDetails: TicketDetails;
}

export function TicketTimeline({ ticketDetails }: TicketTimelineProps) {
  const [showAllMessages, setShowAllMessages] = useState(false);

  // Group messages
  const messages = ticketDetails.messages || [];
  const auditLogs = ticketDetails.auditLogs || [];

  // Limit threshold for local older messages pagination
  const LIMIT = 15;
  const hasHiddenMessages = messages.length > LIMIT && !showAllMessages;
  const visibleMessages = hasHiddenMessages
    ? messages.slice(messages.length - LIMIT)
    : messages;

  const formatAuditAction = (log: any) => {
    const actorName = log.actor
      ? `${log.actor.firstName} ${log.actor.lastName}`
      : "System Routing Engine";

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

  return (
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
                <AttachmentBadge
                  key={att.id}
                  attachment={att}
                  ticketId={ticketDetails.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messaging Timeline items */}
      <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-black/5">
        {/* Load More Button */}
        {hasHiddenMessages && (
          <div className="flex justify-center pl-8 py-2">
            <button
              type="button"
              onClick={() => setShowAllMessages(true)}
              className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-ink bg-canvas border border-black/10 hover:border-black/20 rounded-full px-4 py-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              Load Older Messages ({messages.length - LIMIT} remaining)
            </button>
          </div>
        )}

        {visibleMessages.map((msg) => {
          const isAgent = msg.senderRole === "agent";
          return (
            <div key={msg.id} className="flex gap-4 relative">
              {/* Avatar */}
              <div
                className={`size-8 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 border z-10 ${
                  msg.isInternal
                    ? "bg-warning/20 border-warning/30 text-warning"
                    : isAgent
                    ? "bg-brand-primary text-brand-secondary border-brand-primary"
                    : "bg-surface border-black/5"
                }`}
              >
                {msg.sender?.initials || "??"}
              </div>

              <div className="space-y-1 text-left flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                  <span className="text-ink font-semibold">
                    {msg.sender?.firstName} {msg.sender?.lastName}
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

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                    msg.isInternal
                      ? "bg-warning/5 border-warning/15 text-warning-ink rounded-tl-none"
                      : "bg-canvas text-ink border-black/10 rounded-tl-none shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <div className="flex flex-wrap gap-2">
                        {msg.attachments.map((att: Attachment) => (
                          <AttachmentBadge
                            key={att.id}
                            attachment={att}
                            ticketId={ticketDetails.id}
                          />
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
        {auditLogs.map((log) => (
          <div
            key={log.id}
            className="flex gap-4 items-center pl-2 py-1 text-left"
          >
            <div className="size-4 rounded-full bg-black/5 border border-black/5 flex items-center justify-center shrink-0 z-10">
              <Clock className="size-2 text-muted-foreground" />
            </div>
            <div className="text-[10px] text-muted-foreground font-mono leading-relaxed">
              <span>{formatAuditAction(log)}</span>
              <span className="mx-2">•</span>
              <span>
                {new Date(log.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
