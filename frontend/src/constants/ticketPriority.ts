export const TICKET_PRIORITIES = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type TicketPriority = typeof TICKET_PRIORITIES[keyof typeof TICKET_PRIORITIES];

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
