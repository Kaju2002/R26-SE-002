/**
 * Dummy inbox threads for the simulated recruiter-chat UI (Detect → Practice chats).
 * Structure mirrors a professional message list: avatar, name, time, snippet, unread.
 */

export type InchatFilterId = 'focused' | 'jobs' | 'unread' | 'saved';

export type InchatAvatarKind = 'person' | 'company';

export type InchatThread = {
  id: string;
  participantName: string;
  /** Optional subtitle, e.g. company or “Recruiter” */
  subtitle?: string;
  avatarKind: InchatAvatarKind;
  /** Shown in circular avatar when avatarKind is person */
  initials?: string;
  lastMessagePreview: string;
  /** Short label for the top-right of the row (e.g. Thu, Apr 22) */
  timestampLabel: string;
  unreadCount: number;
  /** Which filter chips include this thread */
  filterTags: InchatFilterId[];
};

/** Chips shown under the search bar (LinkedIn-style filters, FraudAware copy). */
export const INCHAT_FILTER_OPTIONS: { id: InchatFilterId; label: string }[] = [
  { id: 'focused', label: 'Focused' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'unread', label: 'Unread' },
  { id: 'saved', label: 'Saved' },
];

export const INCHAT_THREADS: InchatThread[] = [
  {
    id: 'th-ecobank',
    participantName: 'Sarah Mensah',
    subtitle: 'Ecobank Ghana · Talent',
    avatarKind: 'person',
    initials: 'SM',
    lastMessagePreview: 'Please confirm your availability for a brief screening call tomorrow.',
    timestampLabel: 'Thu',
    unreadCount: 2,
    filterTags: ['focused', 'jobs', 'unread'],
  },
  {
    id: 'th-demo-scam',
    participantName: 'James Okonkwo',
    subtitle: 'Pinnacle Talent Partners · Demo scam-pattern thread',
    avatarKind: 'person',
    initials: 'JO',
    lastMessagePreview:
      'Wire the ₵850 onboarding clearance today — slots close at 5 PM. Do not mention this to your current employer yet.',
    timestampLabel: 'Now',
    unreadCount: 1,
    filterTags: ['focused', 'jobs', 'unread'],
  },
  {
    id: 'th-zynai',
    participantName: 'ZynAI Recruiting',
    subtitle: 'Remote hiring desk',
    avatarKind: 'company',
    lastMessagePreview: 'Hi — any updates on the documents we requested?',
    timestampLabel: 'Apr 22',
    unreadCount: 0,
    filterTags: ['focused', 'jobs'],
  },
  {
    id: 'th-abinaya',
    participantName: 'Abinaya Rajasekara',
    subtitle: 'Linked you via FraudAware demo',
    avatarKind: 'person',
    initials: 'AR',
    lastMessagePreview: 'Abinaya sent a post: “We’re hiring analysts in Accra…”',
    timestampLabel: 'Wed',
    unreadCount: 3,
    filterTags: ['jobs', 'unread'],
  },
  {
    id: 'th-gtb',
    participantName: 'GTBank Careers',
    avatarKind: 'company',
    lastMessagePreview: 'Thank you for applying. Kindly complete the assessment link within 48h.',
    timestampLabel: 'Jan 29',
    unreadCount: 0,
    filterTags: ['jobs', 'saved'],
  },
  {
    id: 'th-support',
    participantName: 'FraudAware Tips',
    subtitle: 'In-app guidance',
    avatarKind: 'company',
    lastMessagePreview: 'Remember: never pay upfront fees to secure an interview.',
    timestampLabel: 'Mon',
    unreadCount: 0,
    filterTags: ['focused', 'saved'],
  },
];

export function getInchatThreadById(id: string): InchatThread | undefined {
  return INCHAT_THREADS.find((t) => t.id === id);
}
