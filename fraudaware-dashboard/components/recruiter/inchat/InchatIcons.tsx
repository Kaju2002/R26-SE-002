import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <path d="m15 10 4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4Z" />
      <path d="M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    </svg>
  );
}

export function DotsVerticalIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <path d="m15 7-6.5 6.5a2.12 2.12 0 0 0 3 3L18 10a4.24 4.24 0 0 0-6-6L5.5 10.5a6.36 6.36 0 0 0 9 9L21 13" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function MicrophoneIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
