'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  registerCompany,
  registerRecruiter,
  verifyEmail,
} from '@/lib/api/authApi';
import type { PortalConfig, PortalType } from '@/lib/auth/portalConfig';
import { colors } from '@/lib/theme/colors';

type Props = {
  config: PortalConfig;
  portalType: Extract<PortalType, 'recruiter' | 'company'>;
};

export default function PortalRegisterForm({ config, portalType }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      if (portalType === 'recruiter') {
        const response = await registerRecruiter({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          agencyName: agencyName.trim() || undefined,
        });
        setInfo(response.message);
      } else {
        const response = await registerCompany({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          companyName: companyName.trim(),
          website: website.trim() || undefined,
          industry: industry.trim() || undefined,
        });
        setInfo(response.message);
      }
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await verifyEmail({ email: email.trim(), otp: otp.trim() });
      router.push(config.loginPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={step === 'register' ? handleRegister : handleVerify}
      className="w-full"
    >
      <div className="mb-8">
        <h1
          className="text-[1.75rem] font-semibold leading-tight"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {step === 'register'
            ? portalType === 'company'
              ? 'Register your company'
              : 'Create recruiter account'
            : 'Verify your email'}
        </h1>
        <p
          className="mt-2 text-base"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {step === 'register'
            ? config.leftDescription
            : `Enter the 6-digit code sent to ${email}.`}
        </p>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-sm"
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

      {info ? (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: '#C8E6C9',
            backgroundColor: '#E8F5E9',
            color: '#2E7D32',
            fontFamily: 'var(--font-poppins)',
          }}
        >
          {info}
        </div>
      ) : null}

      {step === 'register' ? (
        <div className="space-y-4">
          <Field
            label="Full name"
            value={fullName}
            onChange={setFullName}
            placeholder="Jane Doe"
            required
          />
          <Field
            label="Work email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder={config.emailPlaceholder}
            required
          />
          {portalType === 'recruiter' ? (
            <Field
              label="Agency name (optional)"
              value={agencyName}
              onChange={setAgencyName}
              placeholder="Talent Agency Ltd"
            />
          ) : (
            <>
              <Field
                label="Company name"
                value={companyName}
                onChange={setCompanyName}
                placeholder="Acme Pvt Ltd"
                required
              />
              <Field
                label="Website (optional)"
                value={website}
                onChange={setWebsite}
                placeholder="https://company.com"
              />
              <Field
                label="Industry (optional)"
                value={industry}
                onChange={setIndustry}
                placeholder="Technology"
              />
            </>
          )}
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            required
          />
          <Field
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repeat password"
            required
          />
        </div>
      ) : (
        <Field
          label="Verification code"
          value={otp}
          onChange={setOtp}
          placeholder="6-digit code"
          required
        />
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-base font-medium text-white transition hover:opacity-95 disabled:opacity-70"
        style={{ backgroundColor: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {isSubmitting
          ? 'Please wait...'
          : step === 'register'
            ? 'Create account'
            : 'Verify and continue'}
      </button>

      <p
        className="mt-5 text-center text-sm"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        Already have an account?{' '}
        <Link href={config.loginPath} className="font-medium text-[#202871] underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-xl border border-[#E5E7EE] bg-white px-4 text-base outline-none transition focus:border-[#202871]"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      />
    </div>
  );
}
