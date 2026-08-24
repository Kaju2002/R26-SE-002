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
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  requesterUserId?: string | null;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  linkedType: SupportLinkedType;
  linkedId?: string | null;
  linkedLabel?: string | null;
  internalNote?: string | null;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
};
