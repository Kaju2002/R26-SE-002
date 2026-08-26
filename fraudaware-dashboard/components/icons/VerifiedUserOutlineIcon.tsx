import type { SVGProps } from 'react';

/**
 * material-symbols:verified-user-outline (Apache 2.0)
 * Iconify path — no attribution required for commercial use.
 */
export default function VerifiedUserOutlineIcon({
  size = 24,
  color = 'currentColor',
  title = 'Verified company',
  className,
  ...rest
}: SVGProps<SVGSVGElement> & {
  size?: number | string;
  color?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill={color}
        d="M10.95 15.55L16.6 9.9l-1.425-1.425L10.95 12.7l-2.1-2.1l-1.425 1.425zM12 22q-3.475-.875-5.737-3.988T4 11.1V5l8-3l8 3v6.1q0 3.8-2.262 6.913T12 22m0-2.1q2.6-.825 4.3-3.3t1.7-5.5V6.375l-6-2.25l-6 2.25V11.1q0 3.025 1.7 5.5t4.3 3.3m0-7.9"
      />
    </svg>
  );
}
