export type VerificationDecision = 'pending' | 'approved' | 'rejected';

export type RegistrySignal = {
  source: string;
  found: boolean;
  note?: string;
};

export type CompanyVerificationRequest = {
  id: string;
  userId?: string | null;
  companyName: string;
  registrationNumber: string;
  website: string | null;
  industry: string;
  address: string;
  submittedByName: string;
  submittedByEmail: string;
  submittedAt: string;
  riskScore: number;
  summary: string;
  registrySignals: RegistrySignal[];
  decision: VerificationDecision;
  decisionSource?: 'auto' | 'admin';
  reviewedAt?: string | null;
  rejectionReason?: string | null;
};
