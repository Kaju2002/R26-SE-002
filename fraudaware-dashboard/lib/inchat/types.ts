export type InchatFilterId = 'focused' | 'jobs' | 'unread' | 'saved' | 'archived';

export type InchatAvatarKind = 'person' | 'company';

export type InchatMessageRole = 'recruiter' | 'applicant';

export type InchatMessageAttachment = {
  url: string;
  publicId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  durationMs?: number;
};

export type InchatThread = {
  id: string;
  jobId?: string;
  applicationId?: string;
  /** Grouping key — jobseeker id for recruiter inbox, workspace id for jobseeker inbox. */
  peerUserId?: string;
  jobTitle?: string;
  updatedAtIso?: string;
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
  /** Conversation moderation status from chat-management. */
  status?: 'active' | 'archived' | 'blocked';
  blockedBy?: string | null;
  /** True when the logged-in user blocked this thread. */
  iBlocked?: boolean;
  saved?: boolean;
};

export type InchatMessage = {
  id: string;
  threadId: string;
  role: InchatMessageRole;
  body: string;
  messageType?: 'text' | 'image' | 'file' | 'audio' | 'system';
  attachments?: InchatMessageAttachment[];
  timeLabel: string;
  createdAtIso?: string;
  status?: 'sent' | 'delivered' | 'read';
  deliveredAt?: string | null;
  readAt?: string | null;
  unsent?: boolean;
  deletedForEveryone?: boolean;
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
  { id: 'archived', label: 'Archived' },
];

export type InchatAttachmentKind = 'pdf' | 'fig' | 'html' | 'zip' | 'js' | 'doc' | 'image';

export type InchatAttachment = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: InchatAttachmentKind;
  /** Cloudinary / CDN URL when available */
  url?: string;
};

export type InchatMediaItem = {
  id: string;
  label: string;
  tileColor: string;
  /** Image URL for thumbnail grid */
  url?: string;
};

export type InchatThreadDetails = {
  media: InchatMediaItem[];
  attachments: InchatAttachment[];
};
