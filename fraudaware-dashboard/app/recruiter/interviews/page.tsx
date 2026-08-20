'use client';

import EmployerPlaceholderPage from '@/components/employer/EmployerPlaceholderPage';

const PAGE = {
  title: 'Interviews',
  description:
    'Schedule and manage candidate interviews on a shared calendar. Data will be connected later.',
  upcoming: [
    'Book interview slots with applicants',
    'Calendar view by day, week, and month',
    'Reminders via Email and InChat',
    'Link interviews to jobs and pipeline status',
  ],
};

export default function RecruiterInterviewsPage() {
  return <EmployerPlaceholderPage {...PAGE} />;
}
