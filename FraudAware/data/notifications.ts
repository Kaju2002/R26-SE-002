export type NotificationCategory = 'general' | 'applications';

export type NotificationType =
  | 'auth'
  | 'scam'
  | 'job'
  | 'application'
  | 'system';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  body: string;
  /** Pre-formatted date e.g. "02 Jan 2023" */
  date: string;
  /** Pre-formatted time e.g. "09:43 AM" */
  time: string;
  read?: boolean;
};

export const NOTIFICATIONS: AppNotification[] = [
  /** ---------- General ---------- */
  {
    id: 'gen-1',
    category: 'general',
    type: 'auth',
    title: 'Password Updated',
    body: 'You have successfully updated your password.',
    date: '02 Jan 2026',
    time: '09:43 AM',
  },
  {
    id: 'gen-2',
    category: 'general',
    type: 'auth',
    title: 'Account Created',
    body: 'You have successfully created an account on FraudAware. You can now apply for jobs with our services.',
    date: '02 Jan 2026',
    time: '09:30 AM',
  },
  {
    id: 'gen-3',
    category: 'general',
    type: 'scam',
    title: 'Scam Alert Detected',
    body: 'We detected suspicious activity in a recent recruiter message. Tap to review the analysis.',
    date: '03 Jan 2026',
    time: '11:12 AM',
  },
  {
    id: 'gen-4',
    category: 'general',
    type: 'scam',
    title: 'Phishing Attempt Blocked',
    body: 'A job offer you received was flagged as potential phishing and was added to your watchlist.',
    date: '04 Jan 2026',
    time: '08:21 AM',
  },
  {
    id: 'gen-5',
    category: 'general',
    type: 'job',
    title: 'New Job Match',
    body: 'A verified Frontend Developer role at GTBank Ghana matches your profile.',
    date: '05 Jan 2026',
    time: '02:48 PM',
  },
  {
    id: 'gen-6',
    category: 'general',
    type: 'scam',
    title: 'Fraud Pattern Detected',
    body: 'Multiple fraud signals detected in a recruiter chat. Review the conversation in Detect.',
    date: '06 Jan 2026',
    time: '04:15 PM',
  },
  {
    id: 'gen-7',
    category: 'general',
    type: 'auth',
    title: 'New Sign-in',
    body: 'A new sign-in to your account was detected from a different device.',
    date: '07 Jan 2026',
    time: '07:02 AM',
  },
];

export function getNotificationsByCategory(
  category: NotificationCategory
): AppNotification[] {
  return NOTIFICATIONS.filter((n) => n.category === category);
}
