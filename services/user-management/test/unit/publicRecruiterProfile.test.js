import { describe, expect, it } from "vitest";
import { formatPublicRecruiterProfile } from "../../utils/formatPublicRecruiterProfile.js";

const recruiter = {
  _id: "recruiter-1",
  firstName: "Priya",
  lastName: "Silva",
  headline: "Talent lead",
  role: "Recruiter",
  location: "Colombo",
  avatar: "https://cdn.test/avatar.png",
  email: "private@company.test",
  phone: "+94000000000",
  summary: "Hiring engineers",
  emailVerified: true,
  idVerified: false,
  company: {
    name: "Acme",
    logo: "",
    website: "https://acme.test",
    isVerified: true,
  },
  privacy: {
    profileVisibility: "public",
    allowMessages: true,
  },
};

describe("formatPublicRecruiterProfile", () => {
  it("exposes public recruiter fields without private contact data", () => {
    const profile = formatPublicRecruiterProfile(recruiter, { viewerId: "jobseeker-1" });

    expect(profile.fullName).toBe("Priya Silva");
    expect(profile.company.name).toBe("Acme");
    expect(profile.email).toBeUndefined();
    expect(profile.phone).toBeUndefined();
  });

  it("hides private recruiter details from other viewers", () => {
    const profile = formatPublicRecruiterProfile(
      {
        ...recruiter,
        privacy: { profileVisibility: "private", allowMessages: true },
      },
      { viewerId: "jobseeker-2" }
    );

    expect(profile.fullName).toBe("Recruiter");
    expect(profile.headline).toBe("");
    expect(profile.allowMessages).toBe(false);
  });

  it("lets private recruiters view themselves", () => {
    const profile = formatPublicRecruiterProfile(
      {
        ...recruiter,
        privacy: { profileVisibility: "private", allowMessages: false },
      },
      { viewerId: "recruiter-1" }
    );

    expect(profile.fullName).toBe("Priya Silva");
    expect(profile.isSelf).toBe(true);
  });
});
