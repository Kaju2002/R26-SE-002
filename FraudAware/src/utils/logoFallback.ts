import type { LogoFallbackData } from '../types/profile';

const FALLBACK_PALETTE = [
  { bg: '#FBE0B6', color: '#7A5418' },
  { bg: '#1F2A6E', color: '#FFFFFF' },
  { bg: '#FFE091', color: '#5C3F00' },
  { bg: '#D8E1FF', color: '#202871' },
];

export function buildLogoFallback(name: string): LogoFallbackData | undefined {
  if (!name?.trim()) return undefined;

  const words = name.trim().split(/\s+/).filter(Boolean);
  const text =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];

  return { text, bg: palette.bg, color: palette.color };
}
