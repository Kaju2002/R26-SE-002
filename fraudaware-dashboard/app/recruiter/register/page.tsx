import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import PortalRegisterForm from '@/components/auth/PortalRegisterForm';
import SideAuthLayout from '@/components/auth/SideAuthLayout';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.recruiter;

export const metadata: Metadata = {
  title: `Recruiter Register | ${BRAND_NAME}`,
  description: `Create a ${BRAND_NAME} recruiter account`,
};

export default function RecruiterRegisterPage() {
  return (
    <SideAuthLayout config={config}>
      <PortalRegisterForm config={config} portalType="recruiter" />
    </SideAuthLayout>
  );
}
