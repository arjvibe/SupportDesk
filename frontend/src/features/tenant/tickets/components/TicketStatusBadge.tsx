import { Badge } from "@/components/ui/badge";
import type { TicketStatus } from "../types";

const statusStyles: Record<TicketStatus, string> = {
  new: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  open: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  closed: "bg-black/5 text-muted-foreground border-black/5",
};

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${statusStyles[status] || ""} ${className || ""}`}
    >
      {status}
    </Badge>
  );
}
