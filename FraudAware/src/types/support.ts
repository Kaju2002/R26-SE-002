export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';

export type SupportTicketPriority = 'low' | 'medium' | 'high';

export type SupportLinkedType = 'user' | 'job' | 'report' | 'none';

export type SupportMessageAuthor = 'user' | 'admin';

export type SupportMessage = {
  id: string;
  author: SupportMessageAuthor;
  authorName: string;
  body: string;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigneeName?: string | null;
  linkedType: SupportLinkedType;
  linkedId?: string | null;
  linkedLabel?: string | null;
  messages: SupportMessage[];
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupportTicketRequest = {
  subject: string;
  description: string;
  linkedType?: SupportLinkedType;
  linkedId?: string | null;
  linkedLabel?: string | null;
};
