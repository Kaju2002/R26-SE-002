'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api/authApi';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { saveSession } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

/**
 * Shared Sign In for Company + Super Admin.
 * Redirects to the correct dashboard based on accountType.
 */
export default function UnifiedDashboardLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await login({
        email: email.trim(),
        password,
      });

      const accountType = response.user.accountType;

      if (accountType === 'company') {
        saveSession(response.token, response.user, remember);
        router.push(portalConfigs.company.dashboardPath);
        return;
      }

      if (accountType === 'superadmin') {
        saveSession(response.token, response.user, remember);
        router.push(portalConfigs.admin.dashboardPath);
        return;
      }

      if (accountType === 'recruiter') {
        setError('Invalid email or password for this portal.');
        return;
      }

      setError('Invalid email or password for this portal.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 sm:mb-8">
        <h1
          className="mb-2 text-2xl font-semibold text-gray-800 sm:text-3xl"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Sign In
        </h1>
        <p
          className="text-sm text-gray-500"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
        Enter your email and password to sign in.
      </p>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: '#F5C6CA',
            backgroundColor: '#FDEDEE',
            color: '#C62828',
            fontFamily: 'var(--font-poppins)',
          }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="dashboard-email"
            className="mb-1.5 block text-sm font-medium text-gray-700"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Email<span className="text-red-500">*</span>
          </label>
          <input
            id="dashboard-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#202871] focus:ring-2 focus:ring-[#202871]/20 disabled:opacity-70"
            style={{ fontFamily: 'var(--font-poppins)' }}
          />
        </div>

        <div>
          <label
            htmlFor="dashboard-password"
            className="mb-1.5 block text-sm font-medium text-gray-700"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Password<span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="dashboard-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-4 pr-11 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#202871] focus:ring-2 focus:ring-[#202871]/20 disabled:opacity-70"
              style={{ fontFamily: 'var(--font-poppins)' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              disabled={isSubmitting}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-gray-500 disabled:opacity-70"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.63803 3.57709C4.34513 3.2842 3.87026 3.2842 3.57737 3.57709C3.28447 3.86999 3.28447 4.34486 3.57737 4.63775L4.85323 5.91362C3.74609 6.84199 2.89363 8.06395 2.4155 9.45936C2.3615 9.61694 2.3615 9.78801 2.41549 9.94558C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C11.255 15.3619 12.4422 15.0737 13.4994 14.5598L15.3625 16.4229C15.6554 16.7158 16.1302 16.7158 16.4231 16.4229C16.716 16.13 16.716 15.6551 16.4231 15.3622L4.63803 3.57709ZM12.3608 13.4212L10.4475 11.5079C10.3061 11.5423 10.1584 11.5606 10.0064 11.5606H9.99151C8.96527 11.5606 8.13333 10.7286 8.13333 9.70237C8.13333 9.5461 8.15262 9.39434 8.18895 9.24933L5.91885 6.97923C5.03505 7.69015 4.34057 8.62704 3.92328 9.70247C4.86803 12.1373 7.23361 13.8619 10.0002 13.8619C10.8326 13.8619 11.6287 13.7058 12.3608 13.4212ZM16.0771 9.70249C15.7843 10.4569 15.3552 11.1432 14.8199 11.7311L15.8813 12.7925C16.6329 11.9813 17.2187 11.0143 17.5849 9.94561C17.6389 9.78803 17.6389 9.61696 17.5849 9.45938C16.5055 6.30925 13.5184 4.04303 10.0002 4.04303C9.13525 4.04303 8.30244 4.17999 7.52218 4.43338L8.75139 5.66259C9.1556 5.58413 9.57311 5.54303 10.0002 5.54303C12.7667 5.54303 15.1323 7.26768 16.0771 9.70249Z"
                    fill="#98A2B3"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M10.0002 13.8619C7.23361 13.8619 4.86803 12.1372 3.92328 9.70241C4.86804 7.26761 7.23361 5.54297 10.0002 5.54297C12.7667 5.54297 15.1323 7.26762 16.0771 9.70243C15.1323 12.1372 12.7667 13.8619 10.0002 13.8619ZM10.0002 4.04297C6.48191 4.04297 3.49489 6.30917 2.4155 9.4593C2.3615 9.61687 2.3615 9.78794 2.41549 9.94552C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C13.5184 15.3619 16.5055 13.0957 17.5849 9.94555C17.6389 9.78797 17.6389 9.6169 17.5849 9.45932C16.5055 6.30919 13.5184 4.04297 10.0002 4.04297ZM9.99151 7.84413C8.96527 7.84413 8.13333 8.67606 8.13333 9.70231C8.13333 10.7286 8.96527 11.5605 9.99151 11.5605H10.0064C11.0326 11.5605 11.8646 10.7286 11.8646 9.70231C11.8646 8.67606 11.0326 7.84413 10.0064 7.84413H9.99151Z"
                    fill="#98A2B3"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            className="flex cursor-pointer items-center gap-2 text-sm font-normal text-gray-700 select-none"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-gray-300"
              style={{ accentColor: colors.navy }}
            />
            Keep me logged in
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
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ backgroundColor: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-5">
        <p
          className="text-center text-sm font-normal text-gray-700 sm:text-start"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href={portalConfigs.company.registerPath}
            className="font-medium"
            style={{ color: colors.navy }}
          >
            Company registration
          </Link>
        </p>
      </div>
    </div>
  );
}
