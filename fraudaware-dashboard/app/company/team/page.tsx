'use client';

import EmployerPlaceholderPage from '@/components/employer/EmployerPlaceholderPage';

const PAGE = {
  title: 'Team',
  description:
    'Invite and manage recruiters who share this workspace. Data will be connected later.',
  upcoming: [
    'Invite teammates by email',
    'Roles: owner, recruiter, viewer',
    'Shared jobs, applicants, and InChat access',
    'Remove or suspend workspace members',
  ],
};

export default function CompanyTeamPage() {
  return <EmployerPlaceholderPage {...PAGE} />;
}
