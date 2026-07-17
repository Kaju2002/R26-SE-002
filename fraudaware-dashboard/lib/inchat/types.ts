export type InchatFilterId = 'focused' | 'jobs' | 'unread' | 'saved';

export type InchatAvatarKind = 'person' | 'company';

export type InchatMessageRole = 'recruiter' | 'applicant';

export type InchatThread = {
  id: string;
  participantName: string;
  subtitle?: string;
  avatarKind: InchatAvatarKind;
  initials?: string;
  /** Profile photo URL when available; initials used as fallback. */
  avatarUrl?: string;
  lastMessagePreview: string;
  timestampLabel: string;
  unreadCount: number;
  filterTags: InchatFilterId[];
};

export type InchatMessage = {
  id: string;
  threadId: string;
  role: InchatMessageRole;
  body: string;
  timeLabel: string;
  createdAtIso?: string;
  status?: 'sent' | 'delivered' | 'read';
  deliveredAt?: string | null;
  readAt?: string | null;
  unsent?: boolean;
  scamAnalysis?: {
    status: 'not_checked' | 'pending' | 'safe' | 'flagged' | 'error';
    isScam: boolean;
    score: number | null;
    tactics: string[];
  };
};

export const INCHAT_FILTER_OPTIONS: { id: InchatFilterId; label: string }[] = [
  { id: 'focused', label: 'Focused' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'unread', label: 'Unread' },
  { id: 'saved', label: 'Saved' },
];

export type InchatAttachmentKind = 'pdf' | 'fig' | 'html' | 'zip' | 'js' | 'doc' | 'image';

export type InchatAttachment = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: InchatAttachmentKind;
};

export type InchatMediaItem = {
  id: string;
  label: string;
  tileColor: string;
};

export type InchatThreadDetails = {
  media: InchatMediaItem[];
  attachments: InchatAttachment[];
};
