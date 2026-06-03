import type { TicketDetails } from "../types";

interface TicketHeaderProps {
  ticketDetails: TicketDetails;
}

export function TicketHeader({ ticketDetails }: TicketHeaderProps) {
  const isClosedOrResolved =
    ticketDetails.status === "resolved" || ticketDetails.status === "closed";

  const slaStateStyles = {
    "on-track": "bg-success",
    "at-risk": "bg-warning",
    breached: "bg-danger",
  };

  return (
    <div className="py-3 px-5 border-b border-black/10 bg-canvas flex items-center justify-between gap-4 shrink-0 text-left">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase bg-black/[0.04] px-1.5 py-0.5 rounded text-muted-foreground">
            #{ticketDetails.code}
          </span>
          <h1
            className="font-serif text-lg font-bold text-ink truncate"
            title={ticketDetails.subject}
          >
            {ticketDetails.subject}
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground font-mono">
          <span>
            Client: <strong className="text-ink">{ticketDetails.clientName}</strong>
          </span>
          <span>•</span>
          <span>
            Requester:{" "}
            <strong className="text-ink">
              {ticketDetails.requester.firstName} {ticketDetails.requester.lastName}
            </strong>
          </span>
        </div>
      </div>

      {/* SLA Info */}
      <div className="flex flex-col items-end text-right shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
            SLA Status:
          </span>
          <div className="flex items-center gap-1 bg-surface px-2 py-0.5 rounded-full border border-black/5">
            <span
              className={`size-1.5 rounded-full ${
                slaStateStyles[ticketDetails.slaState] || "bg-muted-foreground"
              }`}
            />
            <span className="text-[9px] font-bold uppercase font-mono">
              {ticketDetails.slaState}
            </span>
          </div>
        </div>
        {!isClosedOrResolved && ticketDetails.slaResolutionDueAt && (
          <span className="text-[8px] text-muted-foreground font-mono mt-0.5">
            Due:{" "}
            {new Date(ticketDetails.slaResolutionDueAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
