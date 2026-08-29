import { describe, expect, it } from "vitest";
import {
  buildLogoFallback,
  formatEducationDuration,
  formatExperienceDuration,
  formatFileSize,
  formatProfileResponse,
} from "../../utils/profileFormatter.js";

describe("profileFormatter", () => {
  it("formats experience and education durations", () => {
    const experience = formatExperienceDuration({
      startDate: new Date("2022-01-01T00:00:00.000Z"),
      endDate: null,
      isCurrentlyWorking: true,
    });
    expect(experience).toMatch(/Jan 2022 - Present/i);

    const education = formatEducationDuration({
      startDate: new Date("2018-09-01T00:00:00.000Z"),
      endDate: new Date("2022-06-01T00:00:00.000Z"),
    });
    expect(education).toMatch(/2018 - 2022/i);
  });

  it("formats file sizes", () => {
    expect(formatFileSize(500)).toBe("500 b");
    expect(formatFileSize(2048)).toBe("2 kb");
    expect(formatFileSize(1048576)).toBe("1.0 mb");
  });

  it("builds logo fallback initials", () => {
    const fallback = buildLogoFallback("Acme Corporation");
    expect(fallback.text).toBe("AC");
    expect(buildLogoFallback("")).toBeUndefined();
  });

  it("shapes profile responses without sensitive fields", () => {
    const response = formatProfileResponse({
      _id: { toString: () => "user-1" },
      email: "user@example.com",
      firstName: "Sam",
      lastName: "Perera",
      role: "Engineer",
      headline: "Backend developer",
      location: "Colombo",
      avatar: "",
      phone: "+94000000000",
      company: {
        name: "Acme",
        logo: "",
        website: "https://acme.test",
        isVerified: true,
      },
      stats: { profileViews: 3, postImpressions: 10 },
      isPremium: false,
      summary: "Builder",
      workExperience: [],
      education: [],
      skills: ["Node.js"],
      languages: [],
      cvFiles: [],
      emailVerified: true,
      idVerified: false,
    });

    expect(response.profile.fullName).toBe("Sam Perera");
    expect(response.details.skills).toEqual(["Node.js"]);
    expect(response.profile.password).toBeUndefined();
  });
});
