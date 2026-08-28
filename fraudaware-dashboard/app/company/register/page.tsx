import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import CompanyRegisterForm from '@/components/auth/CompanyRegisterForm';
import DashboardAuthLayout from '@/components/auth/DashboardAuthLayout';

export const metadata: Metadata = {
  title: `Company Registration | ${BRAND_NAME}`,
  description: `Register your company on ${BRAND_NAME}`,
};

export default function CompanyRegisterPage() {
  return (
    <DashboardAuthLayout
      brandTitle={BRAND_NAME}
      brandDescription="Register your company to post official openings, review applicants, and hire safely."
    >
      <CompanyRegisterForm />
    </DashboardAuthLayout>
  );
}
