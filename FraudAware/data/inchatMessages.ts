/**
 * Seed messages per thread id for the simulated conversation screen (merged with user-sent messages from storage).
 */

export type InchatMessageRole = 'user' | 'contact';

export type InchatMessage = {
  id: string;
  threadId: string;
  role: InchatMessageRole;
  body: string;
  /** Short clock label for demo */
  timeLabel: string;
};

export const INCHAT_MESSAGES_BY_THREAD: Record<string, InchatMessage[]> = {
  'th-ecobank': [
    {
      id: 'm1',
      threadId: 'th-ecobank',
      role: 'contact',
      body: 'Good morning — we shortlisted your CV for the Operations Associate role.',
      timeLabel: '09:12',
    },
    {
      id: 'm2',
      threadId: 'th-ecobank',
      role: 'user',
      body: 'Thank you. Happy to discuss. What are the next steps?',
      timeLabel: '09:20',
    },
    {
      id: 'm3',
      threadId: 'th-ecobank',
      role: 'contact',
      body:
        'Please confirm your availability for a brief screening call tomorrow. Also reply with a photo of your ID for HR — standard process.',
      timeLabel: '09:41',
    },
  ],
  /** Demo thread: looks partly legitimate, last contact message hides classic scam signals for classifier demos */
  'th-demo-scam': [
    {
      id: 'ds-m1',
      threadId: 'th-demo-scam',
      role: 'contact',
      body:
        'Hi — congrats, you moved forward for our Remote Data Analyst screening. I’ve attached a brief overview of the role and pay band (USD + local stipend). Are you free for a 15‑minute intro tomorrow?',
      timeLabel: '08:05',
    },
    {
      id: 'ds-m2',
      threadId: 'th-demo-scam',
      role: 'user',
      body: 'Thanks James. Yes, I can do tomorrow afternoon. Should I expect a calendar invite from your company domain?',
      timeLabel: '08:18',
    },
    {
      id: 'ds-m3',
      threadId: 'th-demo-scam',
      role: 'contact',
      body:
        'Great — calendar invite follows after onboarding clearance. Wire the ₵850 onboarding clearance today via Mobile Money to 055‑XXX‑XXXX (recipient: HR CLEARANCE DESK) before 5 PM — two candidates are fighting for the slot. Keep this confidential until HR confirms; do not alert your current employer or we’ll withdraw the offer.',
      timeLabel: '08:42',
    },
  ],
  'th-zynai': [
    {
      id: 'm1',
      threadId: 'th-zynai',
      role: 'contact',
      body: 'Hi — any updates on the documents we requested?',
      timeLabel: 'Mon',
    },
    {
      id: 'm2',
      threadId: 'th-zynai',
      role: 'user',
      body: 'Which documents exactly? I only received this chat.',
      timeLabel: 'Mon',
    },
  ],
  'th-abinaya': [
    {
      id: 'm1',
      threadId: 'th-abinaya',
      role: 'contact',
      body: 'Abinaya sent a post: “We’re hiring analysts in Accra — DM for details.”',
      timeLabel: 'Wed',
    },
  ],
  'th-gtb': [
    {
      id: 'm1',
      threadId: 'th-gtb',
      role: 'contact',
      body: 'Thank you for applying. Kindly complete the assessment link within 48h.',
      timeLabel: 'Jan 29',
    },
  ],
  'th-support': [
    {
      id: 'm1',
      threadId: 'th-support',
      role: 'contact',
      body: 'Remember: never pay upfront fees to secure an interview.',
      timeLabel: 'Mon',
    },
    {
      id: 'm2',
      threadId: 'th-support',
      role: 'user',
      body: 'Thanks — I’ll use Message Analyzer if something looks off.',
      timeLabel: 'Mon',
    },
  ],
};

export function getMessagesForThread(threadId: string): InchatMessage[] {
  return INCHAT_MESSAGES_BY_THREAD[threadId] ?? [];
}
