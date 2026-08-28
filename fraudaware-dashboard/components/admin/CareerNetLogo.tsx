import { BRAND_LOGO_PATH, BRAND_NAME } from '@/lib/brand';

type Props = {
  variant?: 'full' | 'icon';
  className?: string;
};

export default function CareerNetLogo({ variant = 'full', className = '' }: Props) {
  if (variant === 'icon') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={BRAND_LOGO_PATH}
        alt={BRAND_NAME}
        className={`h-12 w-12 shrink-0 object-cover object-left ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_LOGO_PATH}
      alt={BRAND_NAME}
      className={`h-14 w-auto max-w-[220px] shrink-0 object-contain ${className}`}
    />
  );
}
