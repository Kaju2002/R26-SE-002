import type { Metadata } from 'next';
import PortalLoginForm from '@/components/auth/PortalLoginForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.company;

export const metadata: Metadata = {
  title: 'Company Login | FraudAware',
  description: 'Sign in to the FraudAware company portal',
};

export default function CompanyLoginPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalLoginForm config={config} portalType="company" />
    </SideAuthLayout>
  );
}
