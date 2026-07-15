import type { InchatThread } from './types';

/** Recruiter-side inbox threads (applicants / candidates). */
export const MOCK_INCHAT_THREADS: InchatThread[] = [
  {
    id: 'th-kwame',
    participantName: 'Kwame Asante',
    subtitle: 'Operations Associate · Applied',
    avatarKind: 'person',
    initials: 'KA',
    lastMessagePreview:
      'Please confirm your availability for a brief screening call tomorrow.',
    timestampLabel: 'Thu',
    unreadCount: 2,
    filterTags: ['focused', 'jobs', 'unread'],
  },
  {
    id: 'th-amina',
    participantName: 'Amina Bello',
    subtitle: 'Remote Data Analyst · Shortlisted',
    avatarKind: 'person',
    initials: 'AB',
    lastMessagePreview:
      'Thanks — yes, I can do tomorrow afternoon. Should I expect a calendar invite?',
    timestampLabel: 'Now',
    unreadCount: 1,
    filterTags: ['focused', 'jobs', 'unread'],
  },
  {
    id: 'th-david',
    participantName: 'David Osei',
    subtitle: 'Business Analyst · Applied',
    avatarKind: 'person',
    initials: 'DO',
    lastMessagePreview: 'Which documents exactly? I only received this chat.',
    timestampLabel: 'Apr 22',
    unreadCount: 0,
    filterTags: ['focused', 'jobs'],
  },
  {
    id: 'th-priya',
    participantName: 'Priya Nair',
    subtitle: 'Financial Analyst · Referred',
    avatarKind: 'person',
    initials: 'PN',
    lastMessagePreview: 'I completed the assessment link you shared yesterday.',
    timestampLabel: 'Wed',
    unreadCount: 3,
    filterTags: ['jobs', 'unread'],
  },
  {
    id: 'th-michael',
    participantName: 'Michael Chen',
    subtitle: 'Software Engineer · Applied',
    avatarKind: 'person',
    initials: 'MC',
    lastMessagePreview: 'Thank you for applying. Kindly complete the assessment within 48h.',
    timestampLabel: 'Jan 29',
    unreadCount: 0,
    filterTags: ['jobs', 'saved'],
  },
  {
    id: 'th-fraudaware',
    participantName: 'FraudAware Tips',
    subtitle: 'In-app guidance',
    avatarKind: 'company',
    lastMessagePreview: 'Remember: never ask applicants for upfront fees.',
    timestampLabel: 'Mon',
    unreadCount: 0,
    filterTags: ['focused', 'saved'],
  },
];

export function getMockThreadById(id: string): InchatThread | undefined {
  return MOCK_INCHAT_THREADS.find((thread) => thread.id === id);
}
