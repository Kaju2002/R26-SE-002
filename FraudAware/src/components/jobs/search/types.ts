import type { JobMode, JobType } from '../../../../data/jobs';

export type SortOption =
  | 'alphabetical'
  | 'highest_salary'
  | 'newly_posted'
  | 'ending_soon';

export type SalaryCurrencyCode = 'GHS' | 'LKR' | 'USD';

export type JobFilters = {
  mode: JobMode | null;
  types: JobType[];
  location: string;
  /** null = Any currency */
  currency: SalaryCurrencyCode | null;
  /** Slider UI values — only applied when salaryEnabled is true. */
  salaryMin: number;
  salaryMax: number;
  /** When false, salary range is ignored. Requires currency when true. */
  salaryEnabled: boolean;
  salaryPeriod: 'per month';
  experience: string[];
  education: string[];
  industry: string[];
};

export const SALARY_CURRENCIES: {
  code: SalaryCurrencyCode;
  label: string;
  symbol: string;
}[] = [
  { code: 'GHS', label: 'GHS', symbol: 'GH¢' },
  { code: 'LKR', label: 'LKR', symbol: 'LKR' },
  { code: 'USD', label: 'USD', symbol: 'USD' },
];

export const SALARY_SLIDER_BY_CURRENCY: Record<
  SalaryCurrencyCode,
  { min: number; max: number; lower: number; upper: number; step: number }
> = {
  GHS: { min: 1000, max: 20000, lower: 2500, upper: 7500, step: 500 },
  LKR: { min: 20000, max: 200000, lower: 50000, upper: 120000, step: 5000 },
  USD: { min: 200, max: 10000, lower: 500, upper: 3000, step: 100 },
};

/** Legacy GHS-oriented defaults used when currency is Any. */
export const SALARY_SLIDER_DEFAULTS = SALARY_SLIDER_BY_CURRENCY.GHS;

export const DEFAULT_JOB_FILTERS: JobFilters = {
  mode: null,
  types: [],
  location: '',
  currency: null,
  salaryMin: SALARY_SLIDER_DEFAULTS.lower,
  salaryMax: SALARY_SLIDER_DEFAULTS.upper,
  salaryEnabled: false,
  salaryPeriod: 'per month',
  experience: [],
  education: [],
  industry: [],
};

/** Normalize API/display currency codes to a filter code. */
export function normalizeSalaryCurrency(
  value?: string | null
): SalaryCurrencyCode | null {
  if (!value?.trim()) return null;
  const raw = value.trim().toUpperCase();
  if (raw === 'GHS' || raw === 'GHC' || raw === 'GH¢' || raw === 'GH₵') {
    return 'GHS';
  }
  if (raw === 'LKR') return 'LKR';
  if (raw === 'USD' || raw === 'US$') return 'USD';
  return null;
}

export function formatSalaryAmount(
  value: number,
  currency: SalaryCurrencyCode
): string {
  const symbol =
    SALARY_CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  if (value >= 1000) {
    const k = value / 1000;
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `${symbol} ${text}k`;
  }
  return `${symbol} ${value}`;
}
