import { Badge } from "@/components/ui/badge";
import type { TicketPriority } from "../types";

const priorityStyles: Record<TicketPriority, string> = {
  low: "bg-black/5 text-muted-foreground border-black/5",
  normal: "bg-black/5 text-ink border-black/10",
  high: "bg-warning/10 text-warning border-warning/20",
  urgent: "bg-danger/10 text-danger border-danger/20 font-bold",
};

interface PriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${priorityStyles[priority] || ""} ${className || ""}`}
    >
      {priority}
    </Badge>
  );
}
