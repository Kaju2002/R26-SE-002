import Image from 'next/image';
import type { ReactNode } from 'react';

const AUTH_NAVY = '#161950';

type Props = {
  children: ReactNode;
  brandTitle?: string;
  brandDescription?: string;
};

/**
 * Split auth: navy brand panel (left) + form (right).
 * Brand color #161950 with grid accents in opposite corners.
 */
export default function DashboardAuthLayout({
  children,
  brandTitle = 'FraudAware',
  brandDescription = 'Secure hiring for companies and platform admins — sign in to continue.',
}: Props) {
  return (
    <div className="relative z-[1] min-h-screen bg-white">
      <div className="relative flex min-h-screen w-full flex-col lg:flex-row">
        {/* Left — full navy brand panel */}
        <div
          className="relative hidden min-h-screen w-full overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-1/2 lg:flex-col lg:items-center lg:justify-center"
          style={{ backgroundColor: AUTH_NAVY }}
        >
          <div className="pointer-events-none absolute right-0 top-0 z-0 w-full max-w-[280px] xl:max-w-[450px]">
            <Image
              src="/images/auth/grid-01.svg"
              alt=""
              width={450}
              height={254}
              className="h-auto w-full select-none"
              priority
            />
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 z-0 w-full max-w-[280px] xl:max-w-[450px]">
            <Image
              src="/images/auth/grid-01-bottom.svg"
              alt=""
              width={450}
              height={254}
              className="h-auto w-full select-none"
              priority
            />
          </div>

          <div className="relative z-[1] flex max-w-xs flex-col items-center px-8 text-center">
            <div
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              aria-hidden
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3L4 8v8l8 5 8-5V8l-8-5z"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 12.2l1.8 1.8 3.7-3.9"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p
              className="text-3xl font-semibold tracking-tight text-white"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {brandTitle}
            </p>
            <p
              className="mt-3 text-sm leading-relaxed text-white/65"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {brandDescription}
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex w-full flex-1 flex-col bg-white lg:w-1/2">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 sm:px-8 sm:py-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
