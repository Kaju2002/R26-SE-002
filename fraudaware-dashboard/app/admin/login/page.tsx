import type { Metadata } from 'next';
import PortalLoginForm from '@/components/auth/PortalLoginForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.admin;

export const metadata: Metadata = {
  title: 'Super Admin Login | FraudAware',
  description: 'Sign in to the FraudAware super admin portal',
};

export default function AdminLoginPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalLoginForm config={config} portalType="admin" />
    </SideAuthLayout>
  );
}
