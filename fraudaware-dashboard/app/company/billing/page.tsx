'use client';

import EmployerPlaceholderPage from '@/components/employer/EmployerPlaceholderPage';

const PAGE = {
  title: 'Billing',
  description:
    'Plans, invoices, and payment methods for your hiring workspace. Data will be connected later.',
  upcoming: [
    'Current plan and usage limits',
    'Upgrade or change subscription',
    'Invoices and payment history',
    'Billing contacts and tax details',
  ],
};

export default function CompanyBillingPage() {
  return <EmployerPlaceholderPage {...PAGE} />;
}
