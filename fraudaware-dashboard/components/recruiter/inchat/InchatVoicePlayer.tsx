'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import { MicrophoneIcon } from '@/components/recruiter/inchat/InchatIcons';

type Props = {
  url: string;
  durationMs?: number;
  mine?: boolean;
  avatarUrl?: string | null;
  initials?: string;
};

const WAVE_HEIGHTS = [
  6, 11, 8, 14, 9, 16, 7, 12, 15, 8, 17, 10, 13, 6, 15, 11, 14, 8, 16, 9, 13, 7, 12, 10, 15, 8, 16,
  10, 12, 11,
];

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function InchatVoicePlayer({
  url,
  durationMs = 0,
  mine = false,
  avatarUrl,
  initials = '?',
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [knownDuration, setKnownDuration] = useState(durationMs);
  const label = initials.slice(0, 2).toUpperCase();

  useEffect(() => {
    const audio = new Audio(url);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTime = () => setPositionMs(audio.currentTime * 1000);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setKnownDuration(audio.duration * 1000);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setPositionMs(0);
      audio.currentTime = 0;
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    setKnownDuration(durationMs);
    setPositionMs(0);
    setPlaying(false);
  }, [durationMs, url]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setPlaying(false);
    }
  }, []);

  const labelMs =
    playing || positionMs > 0
      ? knownDuration > 0
        ? Math.max(0, knownDuration - positionMs)
        : positionMs
      : knownDuration;
  const progress =
    knownDuration > 0 ? Math.min(1, Math.max(0, positionMs / knownDuration)) : 0;
  const activeBars = Math.round(progress * WAVE_HEIGHTS.length);
  const barIdle = '#C5CAD8';
  const barActive = INCHAT_NAVY;

  return (
    <div className="flex max-w-[250px] min-w-[210px] items-center gap-1.5 py-0.5">
      <div className="relative h-9 w-9 shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
            style={{ backgroundColor: '#DDE3F5' }}
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: '#DDE3F5' }}
          >
            <span
              className="text-[11px] font-bold"
              style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
            >
              {label}
            </span>
          </div>
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white"
          style={{ backgroundColor: mine ? '#5B6CFF' : '#667085' }}
          aria-hidden
        >
          <MicrophoneIcon width={8} height={8} stroke="#fff" strokeWidth={2} />
        </span>
      </div>

      <button
        type="button"
        onClick={() => void toggle()}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-full"
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        style={{ color: INCHAT_NAVY }}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1 pr-0.5">
        <div className="relative flex h-5 items-center gap-[1.5px]">
          {WAVE_HEIGHTS.map((height, index) => (
            <span
              key={`w-${index}`}
              className="inline-block w-0.5 rounded-sm"
              style={{
                height,
                backgroundColor: index <= activeBars ? barActive : barIdle,
              }}
            />
          ))}
          <span
            className="absolute top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-[#1F2937]"
            style={{ left: `${Math.min(96, Math.max(0, progress * 100))}%` }}
          />
        </div>
        <p
          className="mt-0 text-[11px] font-semibold leading-none"
          style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
        >
          {formatMmSs(labelMs)}
        </p>
      </div>
    </div>
  );
}
