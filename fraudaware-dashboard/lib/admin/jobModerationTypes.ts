export type JobModerationStatus = 'flagged' | 'cleared' | 'force_closed';

export type JobFlagReason =
  | 'fake_job_model'
  | 'user_report'
  | 'payment_request'
  | 'suspicious_employer'
  | 'duplicate_scam_pattern';

export type ModeratedJob = {
  id: string;
  title: string;
  companyName: string;
  posterType: 'recruiter' | 'company';
  posterName: string;
  posterEmail: string;
  location: string;
  mode: 'On-Site' | 'Remote' | 'Hybrid';
  type: 'Full-Time' | 'Part-Time' | 'Contract' | 'Internship';
  salaryLabel: string;
  description: string;
  listingStatus: 'active' | 'closed' | 'pending_review' | 'draft';
  moderationStatus: JobModerationStatus;
  fakeJobScore: number;
  flagReasons: JobFlagReason[];
  reportCount: number;
  applicants: number;
  postedAt: string;
  flaggedAt: string;
  reviewedAt?: string | null;
  closeReason?: string | null;
  riskMessage?: string;
  riskPrediction?: string;
};
