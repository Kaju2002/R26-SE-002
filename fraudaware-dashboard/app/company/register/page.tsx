import type { Metadata } from 'next';
import CompanyRegisterForm from '@/components/auth/CompanyRegisterForm';
import DashboardAuthLayout from '@/components/auth/DashboardAuthLayout';

export const metadata: Metadata = {
  title: 'Company Registration | FraudAware',
  description: 'Register your company on FraudAware',
};

export default function CompanyRegisterPage() {
  return (
    <DashboardAuthLayout
      brandTitle="FraudAware"
      brandDescription="Register your company to post official openings, review applicants, and hire safely."
    >
      <CompanyRegisterForm />
    </DashboardAuthLayout>
  );
}
