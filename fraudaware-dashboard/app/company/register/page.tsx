import type { Metadata } from 'next';
import PortalRegisterForm from '@/components/auth/PortalRegisterForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.company;

export const metadata: Metadata = {
  title: 'Company Register | FraudAware',
  description: 'Register your company on FraudAware',
};

export default function CompanyRegisterPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalRegisterForm config={config} portalType="company" />
    </SideAuthLayout>
  );
}
