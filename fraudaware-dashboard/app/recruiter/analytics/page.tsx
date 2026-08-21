'use client';

import EmployerPlaceholderPage from '@/components/employer/EmployerPlaceholderPage';

const PAGE = {
  title: 'Analytics',
  description:
    'Hiring performance: views, apply rates, and pipeline conversion. Data will be connected later.',
  upcoming: [
    'Job views and application conversion rates',
    'Pipeline funnel: pending → accepted → hired',
    'Time-to-fill and response metrics',
    'Export summaries for stakeholders',
  ],
};

export default function RecruiterAnalyticsPage() {
  return <EmployerPlaceholderPage {...PAGE} />;
}
