export const TICKET_STATUSES = {
  NEW: "new",
  OPEN: "open",
  PENDING: "pending",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;

export type TicketStatus = typeof TICKET_STATUSES[keyof typeof TICKET_STATUSES];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};
