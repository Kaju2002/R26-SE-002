'use client';

import EmployerPlaceholderPage from '@/components/employer/EmployerPlaceholderPage';

const PAGE = {
  title: 'Templates',
  description:
    'Reusable Email and InChat reply templates for faster hiring outreach. Data will be connected later.',
  upcoming: [
    'Create templates for screening, interviews, and offers',
    'Insert variables like name, job title, and company',
    'Share templates across your workspace team',
    'Use templates from Applicants, Email, and InChat',
  ],
};

export default function CompanyTemplatesPage() {
  return <EmployerPlaceholderPage {...PAGE} />;
}
