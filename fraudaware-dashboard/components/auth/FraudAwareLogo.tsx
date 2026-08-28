import { BRAND_LOGO_PATH, BRAND_NAME } from '@/lib/brand';
import { colors } from '@/lib/theme/colors';

type Props = {
  subtitle?: string;
};

export default function FraudAwareLogo({ subtitle }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_PATH}
        alt={BRAND_NAME}
        className="h-11 w-auto max-w-[190px] shrink-0 object-contain object-left"
      />
      {subtitle ? (
        <p
          className="text-sm font-medium"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
