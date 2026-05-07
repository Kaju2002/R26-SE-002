import type { JobMode, JobType } from '../../../../data/jobs';

export type SortOption =
  | 'alphabetical'
  | 'highest_salary'
  | 'newly_posted'
  | 'ending_soon';

export type JobFilters = {
  mode: JobMode | null;
  types: JobType[];
  location: string;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: 'per month';
  experience: string[];
  education: string[];
  industry: string[];
};

export const DEFAULT_JOB_FILTERS: JobFilters = {
  mode: null,
  types: [],
  location: '',
  salaryMin: 2500,
  salaryMax: 7500,
  salaryPeriod: 'per month',
  experience: [],
  education: [],
  industry: [],
};
