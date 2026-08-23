import type { Metadata } from 'next';
import DashboardAuthLayout from '@/components/auth/DashboardAuthLayout';
import UnifiedDashboardLoginForm from '@/components/auth/UnifiedDashboardLoginForm';

export const metadata: Metadata = {
  title: 'Sign In | FraudAware',
  description: 'Sign in to FraudAware Company or Admin dashboard',
};

export default function LoginPage() {
  return (
    <DashboardAuthLayout>
      <UnifiedDashboardLoginForm />
    </DashboardAuthLayout>
  );
}
