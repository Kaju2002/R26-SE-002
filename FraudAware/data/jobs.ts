import type { ImageSourcePropType } from 'react-native';
import type { LogoFallbackData } from '../src/types/profile';
import type { ApplicationStatus } from './applicationNotifications';

export type JobMode = 'On-Site' | 'Remote' | 'Hybrid';
export type JobType =
  | 'Full-Time'
  | 'Part-Time'
  | 'Contract'
  | 'Internship';

export type JobContact = {
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
};

export type Job = {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: ImageSourcePropType;
  companyFallback?: LogoFallbackData;
  isVerified?: boolean;
  location: string;
  postedAt: string;
  endsAt?: string;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  salaryPeriod?: string;
  type: JobType;
  mode: JobMode;
  matchScore?: number;
  applicationStatus?: ApplicationStatus;
  applicants?: number;

  description?: string[];
  requirements?: string[];
  benefits?: string[];
  jobLevel?: string;
  education?: string;
  experience?: string;
  skills?: string[];
  perks?: string[];

  about?: string;
  contact?: JobContact;
  postedBy?: string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function formatSalaryRange(job: Job): string {
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (job.salaryMin === job.salaryMax) {
    return `${job.salaryCurrency} ${fmt(job.salaryMin)}`;
  }
  return `${job.salaryCurrency} ${fmt(job.salaryMin)} - ${fmt(job.salaryMax)}`;
}

export function formatSalary(job: Job): string {
  const range = formatSalaryRange(job);
  return job.salaryPeriod ? `${range} ${job.salaryPeriod}` : range;
}

export function formatPostedAt(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return '';

  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diff / HOUR);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
