import { describe, expect, it } from "vitest";
import {
  MIN_DESCRIPTION_LENGTH,
  normalizeJobCreateInput,
  normalizeJobUpdateInput,
} from "../../utils/jobPayloadNormalizer.js";

const validCreateBody = () => ({
  title: "Software Engineer",
  companyName: "Acme Ltd",
  location: "Accra",
  mode: "Remote",
  type: "Full-Time",
  description: "A".repeat(MIN_DESCRIPTION_LENGTH),
  skills: "python, django",
  salaryMin: 1000,
  salaryMax: 2000,
});

describe("normalizeJobCreateInput", () => {
  it("normalizes a valid create payload", () => {
    const result = normalizeJobCreateInput(validCreateBody());

    expect(result.errors).toEqual([]);
    expect(result.document.title).toBe("Software Engineer");
    expect(result.document.skills).toEqual(["python", "django"]);
    expect(result.document.salaryCurrency).toBe("GHS");
    expect(result.document.salaryPeriod).toBe("/mo");
  });

  it("collects errors for missing required fields", () => {
    const result = normalizeJobCreateInput({});

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(" ")).toMatch(/title/i);
    expect(result.errors.join(" ")).toMatch(/company name/i);
    expect(result.errors.join(" ")).toMatch(/location/i);
  });

  it("rejects descriptions shorter than the minimum", () => {
    const result = normalizeJobCreateInput({
      ...validCreateBody(),
      description: "too short",
    });

    expect(result.errors.some((msg) => msg.includes(String(MIN_DESCRIPTION_LENGTH)))).toBe(
      true
    );
  });

  it("rejects partial salary pairs", () => {
    const result = normalizeJobCreateInput({
      ...validCreateBody(),
      salaryMax: "",
    });

    expect(result.errors.join(" ")).toMatch(/both minimum and maximum salary/i);
  });

  it("rejects when minimum salary exceeds maximum", () => {
    const result = normalizeJobCreateInput({
      ...validCreateBody(),
      salaryMin: 5000,
      salaryMax: 1000,
    });

    expect(result.errors.join(" ")).toMatch(/cannot be greater than maximum/i);
  });

  it("rejects invalid closing dates", () => {
    const result = normalizeJobCreateInput({
      ...validCreateBody(),
      closingDate: "not-a-date",
    });

    expect(result.errors.join(" ")).toMatch(/closing date is invalid/i);
  });
});

describe("normalizeJobUpdateInput", () => {
  const existingJob = {
    title: "Old Title",
    companyName: "Acme Ltd",
    location: "Accra",
    mode: "Remote",
    type: "Full-Time",
    salaryMin: 1000,
    salaryMax: 2000,
    contact: {
      location: "Accra",
      email: "hr@acme.com",
      phone: "+233000",
      website: "https://acme.com",
    },
  };

  it("builds a patch for valid partial updates", () => {
    const result = normalizeJobUpdateInput(
      { title: "New Title", skills: "react, node" },
      null,
      existingJob
    );

    expect(result.errors).toEqual([]);
    expect(result.patch.title).toBe("New Title");
    expect(result.patch.skills).toEqual(["react", "node"]);
  });

  it("merges contact updates without wiping untouched fields", () => {
    const result = normalizeJobUpdateInput(
      { contact: { phone: "+233111" } },
      null,
      existingJob
    );

    expect(result.errors).toEqual([]);
    expect(result.patch.contact.phone).toBe("+233111");
    expect(result.patch.contact.email).toBe("hr@acme.com");
    expect(result.patch.contact.website).toBe("https://acme.com");
  });

  it("returns an error when no valid fields are provided", () => {
    const result = normalizeJobUpdateInput({}, null, existingJob);

    expect(result.errors).toEqual(["No valid fields provided to update"]);
  });

  it("rejects empty title updates", () => {
    const result = normalizeJobUpdateInput({ title: "   " }, null, existingJob);

    expect(result.errors.join(" ")).toMatch(/title cannot be empty/i);
  });
});
