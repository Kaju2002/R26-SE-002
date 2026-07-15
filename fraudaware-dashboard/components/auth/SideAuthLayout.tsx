import Image from 'next/image';
import type { ReactNode } from 'react';
import type { PortalConfig } from '@/lib/auth/portalConfig';
import FraudAwareLogo from './FraudAwareLogo';
import { colors } from '@/lib/theme/colors';

type Props = {
  children: ReactNode;
  config: PortalConfig;
};

export default function SideAuthLayout({ children, config }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]">
        <div
          className="relative hidden overflow-hidden lg:flex lg:flex-col"
          style={{ background: colors.panelGradient }}
        >
          <div className="relative z-10 px-8 pt-8">
            <FraudAwareLogo subtitle={config.portalLabel} />
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-10 pb-10">
            <div className="w-full max-w-[520px]">
              <Image
                src={config.illustration}
                alt={config.illustrationAlt}
                width={520}
                height={520}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="relative z-10 px-8 pb-10">
            <p
              className="max-w-md text-base leading-relaxed"
              style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
            >
              {config.leftDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 lg:hidden">
              <FraudAwareLogo subtitle={config.portalLabel} />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
