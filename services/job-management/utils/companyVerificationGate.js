const EMPLOYER_ACCOUNT_TYPES = new Set(["recruiter", "company"]);

export class CompanyVerificationGateError extends Error {
  constructor(
    message = "Your company must be verified before publishing live jobs."
  ) {
    super(message);
    this.name = "CompanyVerificationGateError";
    this.status = 403;
    this.code = "COMPANY_NOT_VERIFIED";
  }
}

export const isEmployerAccount = (user) =>
  EMPLOYER_ACCOUNT_TYPES.has(user?.accountType);

export const isCompanyVerified = (user) => Boolean(user?.company?.isVerified);

export const assertCanPublishJob = (user, requestedStatus, options = {}) => {
  const status = String(requestedStatus || "").toLowerCase();
  if (status !== "active") return;
  if (!isEmployerAccount(user)) return;

  const previousStatus = String(options.previousStatus || "").toLowerCase();
  if (previousStatus === "active") return;
  if (isCompanyVerified(user)) return;

  throw new CompanyVerificationGateError(
    "Your company must be verified before a job can go live. Save as draft and complete verification first."
  );
};
