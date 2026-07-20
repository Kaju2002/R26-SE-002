import type { Metadata } from 'next';
import PortalRegisterForm from '@/components/auth/PortalRegisterForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.recruiter;

export const metadata: Metadata = {
  title: 'Recruiter Register | FraudAware',
  description: 'Create a FraudAware recruiter account',
};

export default function RecruiterRegisterPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalRegisterForm config={config} portalType="recruiter" />
    </SideAuthLayout>
  );
}
