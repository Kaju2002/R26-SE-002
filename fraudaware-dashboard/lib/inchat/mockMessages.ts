import type { InchatMessage } from './types';

export const MOCK_MESSAGES_BY_THREAD: Record<string, InchatMessage[]> = {
  'th-kwame': [
    {
      id: 'm1',
      threadId: 'th-kwame',
      role: 'recruiter',
      body: 'Good morning — we shortlisted your CV for the Operations Associate role.',
      timeLabel: '09:12',
    },
    {
      id: 'm2',
      threadId: 'th-kwame',
      role: 'applicant',
      body: 'Thank you. Happy to discuss. What are the next steps?',
      timeLabel: '09:20',
    },
    {
      id: 'm3',
      threadId: 'th-kwame',
      role: 'recruiter',
      body:
        'Please confirm your availability for a brief screening call tomorrow. Also reply with a photo of your ID for HR — standard process.',
      timeLabel: '09:41',
    },
  ],
  'th-amina': [
    {
      id: 'ds-m1',
      threadId: 'th-amina',
      role: 'recruiter',
      body:
        'Hi — congrats, you moved forward for our Remote Data Analyst screening. Are you free for a 15-minute intro tomorrow?',
      timeLabel: '08:05',
    },
    {
      id: 'ds-m2',
      threadId: 'th-amina',
      role: 'applicant',
      body: 'Thanks — yes, I can do tomorrow afternoon. Should I expect a calendar invite from your company domain?',
      timeLabel: '08:18',
    },
    {
      id: 'ds-m3',
      threadId: 'th-amina',
      role: 'applicant',
      body: 'Also, could you confirm the interview will be on Microsoft Teams and not WhatsApp?',
      timeLabel: '08:42',
    },
  ],
  'th-david': [
    {
      id: 'm1',
      threadId: 'th-david',
      role: 'recruiter',
      body: 'Hi — any updates on the documents we requested?',
      timeLabel: 'Mon',
    },
    {
      id: 'm2',
      threadId: 'th-david',
      role: 'applicant',
      body: 'Which documents exactly? I only received this chat.',
      timeLabel: 'Mon',
    },
  ],
  'th-priya': [
    {
      id: 'm1',
      threadId: 'th-priya',
      role: 'recruiter',
      body: 'Please complete the assessment link within 48 hours.',
      timeLabel: 'Wed',
    },
    {
      id: 'm2',
      threadId: 'th-priya',
      role: 'applicant',
      body: 'I completed the assessment link you shared yesterday.',
      timeLabel: 'Wed',
    },
  ],
  'th-michael': [
    {
      id: 'm1',
      threadId: 'th-michael',
      role: 'recruiter',
      body: 'Thank you for applying. Kindly complete the assessment within 48h.',
      timeLabel: 'Jan 29',
    },
  ],
  'th-fraudaware': [
    {
      id: 'm1',
      threadId: 'th-fraudaware',
      role: 'recruiter',
      body: 'Remember: never ask applicants for upfront fees.',
      timeLabel: 'Mon',
    },
  ],
};

export function getMockMessagesForThread(threadId: string): InchatMessage[] {
  return MOCK_MESSAGES_BY_THREAD[threadId] ?? [];
}
