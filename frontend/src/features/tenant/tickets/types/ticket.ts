export type Attachment = {
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
};

export type TicketStatus = "new" | "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type SlaState = "on-track" | "at-risk" | "breached";

export type Ticket = {
  id: string;
  code: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  workstream: string | null;
  clientId: string;
  assigneeId: string | null;
  teamId: string | null;
  slaState: SlaState;
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

export type SupportTeam = {
  id: string;
  name: string;
};

export type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
};

export type TicketFeedback = {
  id: string;
  rating: number;
  comment: string | null;
};

export type TicketMessage = {
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

export type AuditLog = {
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

export type TicketDetails = Ticket & {
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
