import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import DashboardAuthLayout from '@/components/auth/DashboardAuthLayout';
import UnifiedDashboardLoginForm from '@/components/auth/UnifiedDashboardLoginForm';

export const metadata: Metadata = {
  title: `Sign In | ${BRAND_NAME}`,
  description: `Sign in to ${BRAND_NAME} Company or Admin dashboard`,
};

export default function LoginPage() {
  return (
    <DashboardAuthLayout>
      <UnifiedDashboardLoginForm />
    </DashboardAuthLayout>
  );
}
