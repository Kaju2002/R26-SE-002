import { colors } from '@/lib/theme/colors';

type Props = {
  subtitle?: string;
};

export default function FraudAwareLogo({ subtitle }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
        style={{ backgroundColor: colors.navy }}
        aria-hidden
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
      <div>
        <p
          className="text-[1.35rem] font-semibold leading-none tracking-tight"
          style={{ color: colors.brandNavy, fontFamily: 'var(--font-poppins)' }}
        >
          FraudAware
        </p>
        {subtitle ? (
          <p
            className="mt-1 text-sm font-medium"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
