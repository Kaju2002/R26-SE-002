import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import PortalLoginForm from '@/components/auth/PortalLoginForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.recruiter;

export const metadata: Metadata = {
  title: `Recruiter Login | ${BRAND_NAME}`,
  description: `Sign in to the ${BRAND_NAME} recruiter portal`,
};

export default function RecruiterLoginPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalLoginForm config={config} portalType="recruiter" />
    </SideAuthLayout>
  );
}
