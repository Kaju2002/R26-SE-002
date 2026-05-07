import type { ImageSourcePropType } from 'react-native';
import type { LogoFallbackData } from './profileDetails';
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
  jobLevel?: string;
  education?: string;
  experience?: string;
  skills?: string[];
  perks?: string[];

  about?: string;
  contact?: JobContact;
};

const now = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const DEFAULT_DESCRIPTION = [
  'Collaborate with cross-functional teams to deliver high-quality outcomes.',
  'Analyse data, identify trends, and drive informed decisions.',
  'Maintain compliance with internal policies and regulatory standards.',
  'Communicate clearly with clients, stakeholders, and senior leadership.',
];

const DEFAULT_PERKS = [
  'Health Insurance',
  'Paid Sick Leave',
  'Paid Vacation Leave',
  'Transport Allowance',
  'Performance Bonus',
];

const DEFAULT_SKILLS = [
  'Communication Skills',
  'Teamwork',
  'Problem Solving',
  'Time Management',
  'Attention to Detail',
];

const DEFAULT_ABOUT =
  'A leading institution in Ghana committed to delivering reliable, customer-first services. We invest in our people, support continuous learning, and build long-term value for the communities we serve.';

function withDefaults(job: Job): Job {
  return {
    description: DEFAULT_DESCRIPTION,
    jobLevel: 'Mid-Level',
    education: "Bachelor's Degree",
    experience: '2+ Years',
    skills: DEFAULT_SKILLS,
    perks: DEFAULT_PERKS,
    about: DEFAULT_ABOUT,
    contact: {
      location: job.location,
      email: `careers@${job.companyName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.com`,
      phone: '+233 20 000 0000',
      website: `www.${job.companyName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.com`,
    },
    endsAt:
      job.endsAt ?? new Date(Date.now() + 30 * DAY).toISOString(),
    ...job,
  };
}

const RECOMMENDED_JOBS_RAW: Job[] = [
  {
    id: 'rec-1',
    title: 'Chartered Accountant',
    companyName: 'Ecobank Ghana PLC',
    companyLogo: require('../assets/icons/ecobank_transnational_icon.jpeg.png'),
    isVerified: true,
    location: 'Lapaz, Accra',
    postedAt: new Date(now - 2 * HOUR).toISOString(),
    salaryMin: 5500,
    salaryMax: 8000,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/mo',
    type: 'Full-Time',
    mode: 'On-Site',
    matchScore: 92,
    applicants: 24,
  },
  {
    id: 'rec-2',
    title: 'Loan Officer',
    companyName: 'GTBank Ghana',
    companyLogo: require('../assets/icons/gtbank_icon.jpeg.png'),
    isVerified: true,
    location: 'East Legon, Accra',
    postedAt: new Date(now - 5 * HOUR).toISOString(),
    salaryMin: 4000,
    salaryMax: 6500,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/mo',
    type: 'Full-Time',
    mode: 'Hybrid',
    matchScore: 87,
    applicants: 41,
    applicationStatus: 'sent',
  },
  {
    id: 'rec-3',
    title: 'Asset Management Analyst',
    companyName: 'Calbank PLC',
    companyLogo: require('../assets/icons/calbank_plc_icon.jpeg.png'),
    isVerified: true,
    location: 'Adum, Kumasi',
    postedAt: '2024-04-19T00:00:00.000Z',
    endsAt: '2024-09-27T00:00:00.000Z',
    salaryMin: 6500,
    salaryMax: 9000,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/month',
    type: 'Full-Time',
    mode: 'On-Site',
    matchScore: 89,
    applicants: 12,
    description: [
      'Tergeo damnatio terminatio adeo tergum bos bis.',
      'Optio auditor sui nisi.',
      'Aestivus amplexus tonsor architecto cerno defetiscor.',
      'Maiores approbo error adnuo unde video sursum sint comes.',
    ],
    jobLevel: 'Supervisor',
    education: "Bachelor's Degree",
    experience: '3+ Years',
    skills: [
      'Financial Analysis',
      'Portfolio Management',
      'Investment Research',
      'Risk Management',
      'Data Analysis',
      'Excel Proficiency',
      'Communication Skills',
      'Analytical Thinking',
    ],
    perks: [
      'Health Insurance',
      'Paid Sick Leave',
      'Paid Vacation Leave',
      'Transport Allowance',
      'Performance Bonus',
    ],
    about:
      'Ater inflammatio bis provident aspicio aetas utroque ver commodo. Venustas vox amplus defaeco vero delicate architecto ciminatio absque vindico. Spargo volaticus vado deporto accendo advoco. Valde debeo stipes caelestis accusamus valetudo nemo totus valeo.',
    contact: {
      location: 'Adum, Kumasi',
      email: 'hr@calbank.net',
      phone: '+233 20 234 5678',
      website: 'www.calbank.net',
    },
  },
  {
    id: 'rec-4',
    title: 'IT Consultant',
    companyName: 'Calbank PLC',
    companyLogo: require('../assets/icons/calbank_plc_icon.jpeg.png'),
    isVerified: false,
    location: 'Adum, Kumasi',
    postedAt: new Date(now - 2 * DAY).toISOString(),
    endsAt: new Date(now + 30 * DAY).toISOString(),
    salaryMin: 7000,
    salaryMax: 7000,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/mo',
    type: 'Part-Time',
    mode: 'Remote',
    matchScore: 76,
    applicants: 8,
  },
];

const RECENT_JOBS_RAW: Job[] = [
  {
    id: 'rcn-1',
    title: 'Asset Management Analyst',
    companyName: 'Ghana Commercial Bank',
    companyFallback: { text: 'GCB', bg: '#FBE0B6', color: '#7A5418' },
    isVerified: true,
    location: 'Circle, Accra',
    postedAt: new Date(now - 3 * HOUR).toISOString(),
    salaryMin: 4500,
    salaryMax: 6000,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/mo',
    type: 'Part-Time',
    mode: 'On-Site',
    applicants: 17,
  },
  {
    id: 'rcn-2',
    title: 'Consumer Loan Officer',
    companyName: 'Consolidated Bank Ghana',
    companyFallback: { text: 'C', bg: '#1F2A6E', color: '#FFFFFF' },
    isVerified: true,
    location: 'Lapaz, Accra',
    postedAt: new Date(now - 6 * HOUR).toISOString(),
    salaryMin: 4500,
    salaryMax: 6000,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/mo',
    type: 'Full-Time',
    mode: 'On-Site',
    applicants: 33,
    applicationStatus: 'pending',
  },
  {
    id: 'rcn-3',
    title: 'IT Consultant',
    companyName: 'Calbank PLC',
    companyFallback: { text: 'CB', bg: '#FBE0B6', color: '#7A5418' },
    isVerified: false,
    location: 'Adum, Kumasi',
    postedAt: new Date(now - 1 * DAY).toISOString(),
    salaryMin: 7000,
    salaryMax: 7000,
    salaryCurrency: 'GH¢',
    salaryPeriod: '/mo',
    type: 'Part-Time',
    mode: 'Remote',
    applicants: 5,
  },
];

export const RECOMMENDED_JOBS: Job[] = RECOMMENDED_JOBS_RAW.map(withDefaults);
export const RECENT_JOBS: Job[] = RECENT_JOBS_RAW.map(withDefaults);

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

export function findJobById(id: string): Job | undefined {
  return [...RECOMMENDED_JOBS, ...RECENT_JOBS].find((j) => j.id === id);
}
