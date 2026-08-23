'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerCompany, verifyEmail } from '@/lib/api/authApi';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { colors } from '@/lib/theme/colors';

const loginPath = portalConfigs.company.loginPath;

/**
 * Company registration + email OTP verify — matches DashboardAuthLayout login styling.
 */
export default function CompanyRegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await registerCompany({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        companyName: companyName.trim(),
        website: website.trim() || undefined,
        industry: industry.trim() || undefined,
      });
      setInfo(response.message || 'Check your email for a verification code.');
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
      router.push(loginPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
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
          {step === 'register' ? 'Company registration' : 'Verify your email'}
        </h1>
        <p
          className="text-sm text-gray-500"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {step === 'register'
            ? 'Create your company account to post jobs and hire on FraudAware.'
            : `Enter the 6-digit code sent to ${email}.`}
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

      {info ? (
        <div
          className="mb-5 rounded-lg border px-4 py-3 text-sm"
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

      <form
        onSubmit={step === 'register' ? handleRegister : handleVerify}
        className="space-y-4"
      >
        {step === 'register' ? (
          <>
            <Field
              id="reg-fullName"
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Jane Doe"
              required
            />
            <Field
              id="reg-email"
              label="Work email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="hiring@yourcompany.com"
              required
            />
            <Field
              id="reg-company"
              label="Company name"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Acme Pvt Ltd"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="reg-website"
                label="Website"
                value={website}
                onChange={setWebsite}
                placeholder="https://company.com"
                optional
              />
              <Field
                id="reg-industry"
                label="Industry"
                value={industry}
                onChange={setIndustry}
                placeholder="Technology"
                optional
              />
            </div>
            <div>
              <label
                htmlFor="reg-password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-4 pr-11 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#161950] focus:ring-2 focus:ring-[#161950]/20 disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <Field
              id="reg-confirm"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
          </>
        ) : (
          <Field
            id="reg-otp"
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
          className="mt-2 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ backgroundColor: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {isSubmitting
            ? 'Please wait...'
            : step === 'register'
              ? 'Create account'
              : 'Verify and continue'}
        </button>
      </form>

      <p
        className="mt-5 text-center text-sm text-gray-700 sm:text-start"
        style={{ fontFamily: 'var(--font-poppins)' }}
      >
        Already have an account?{' '}
        <Link href={loginPath} className="font-medium" style={{ color: '#161950' }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  optional,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-gray-700"
        style={{ fontFamily: 'var(--font-poppins)' }}
      >
        {label}
        {required ? <span className="text-red-500">*</span> : null}
        {optional ? (
          <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
        ) : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#161950] focus:ring-2 focus:ring-[#161950]/20"
        style={{ fontFamily: 'var(--font-poppins)' }}
      />
    </div>
  );
}
