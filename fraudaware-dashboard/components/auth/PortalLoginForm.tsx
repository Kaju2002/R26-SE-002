'use client';

import { FormEvent, useState } from 'react';
import type { PortalConfig } from '@/lib/auth/portalConfig';
import { colors } from '@/lib/theme/colors';

type Props = {
  config: PortalConfig;
  portalId: string;
};

export default function PortalLoginForm({ config, portalId }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const emailInputId = `${portalId}-email`;
  const passwordInputId = `${portalId}-password`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Backend wiring and role-based redirect come in the next step.
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="mb-8">
        <h1
          className="text-[1.75rem] font-semibold leading-tight"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {config.title}
        </h1>
        <p
          className="mt-2 text-base"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {config.subtitle}
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor={emailInputId}
            className="mb-2 block text-sm font-medium"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Email
          </label>
          <input
            id={emailInputId}
            type="email"
            autoComplete="email"
            placeholder={config.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition focus:border-[#202871] focus:ring-2 focus:ring-[#20287133]"
            style={{
              borderColor: colors.inputBorder,
              color: colors.navy,
              fontFamily: 'var(--font-poppins)',
            }}
          />
        </div>

        <div>
          <label
            htmlFor={passwordInputId}
            className="mb-2 block text-sm font-medium"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id={passwordInputId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border bg-white px-4 pr-12 text-base outline-none transition focus:border-[#202871] focus:ring-2 focus:ring-[#20287133]"
              style={{
                borderColor: colors.inputBorder,
                color: colors.navy,
                fontFamily: 'var(--font-poppins)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
              style={{ color: colors.periwinkle, fontFamily: 'var(--font-poppins)' }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 rounded border"
            style={{ accentColor: colors.navy, borderColor: colors.inputBorder }}
          />
          <span
            className="text-sm"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Remember this device
          </span>
        </label>

        <button
          type="button"
          className="text-sm font-medium"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        className="mt-8 h-12 w-full rounded-xl text-base font-medium text-white transition hover:opacity-95"
        style={{ backgroundColor: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        Sign In
      </button>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {config.footerNote}
      </p>
    </form>
  );
}
