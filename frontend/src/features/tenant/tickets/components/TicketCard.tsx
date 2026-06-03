import type { Ticket } from "../types";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { PriorityBadge } from "./PriorityBadge";

interface TicketCardProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
}

export function TicketCard({ ticket, isSelected, onClick }: TicketCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer text-left transition-colors relative ${
        isSelected ? "bg-surface" : "hover:bg-surface/40"
      }`}
    >
      {/* Active Indicator bar */}
      {isSelected && (
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
          <TicketStatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>
    </div>
  );
}
