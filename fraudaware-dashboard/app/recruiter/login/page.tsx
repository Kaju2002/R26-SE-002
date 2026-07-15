import type { Metadata } from 'next';
import PortalLoginForm from '@/components/auth/PortalLoginForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.recruiter;

export const metadata: Metadata = {
  title: 'Recruiter Login | FraudAware',
  description: 'Sign in to the FraudAware recruiter portal',
};

export default function RecruiterLoginPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalLoginForm config={config} portalType="recruiter" />
    </SideAuthLayout>
  );
}
