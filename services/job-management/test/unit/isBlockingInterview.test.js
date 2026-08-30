import { describe, expect, it } from "vitest";
import { isBlockingInterview } from "../../model/interviewModel.js";

const futureEnd = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const pastEnd = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
const fixedNow = new Date("2026-08-29T12:00:00.000Z").getTime();

describe("isBlockingInterview", () => {
  it("blocks scheduled interviews that have not ended yet", () => {
    expect(
      isBlockingInterview(
        { status: "scheduled", endsAt: "2026-08-29T14:00:00.000Z" },
        fixedNow
      )
    ).toBe(true);
  });

  it("blocks rescheduled interviews that have not ended yet", () => {
    expect(
      isBlockingInterview(
        { status: "rescheduled", endsAt: "2026-08-29T13:30:00.000Z" },
        fixedNow
      )
    ).toBe(true);
  });

  it("does not block scheduled interviews whose end time is in the past", () => {
    expect(
      isBlockingInterview(
        { status: "scheduled", endsAt: "2026-08-29T10:00:00.000Z" },
        fixedNow
      )
    ).toBe(false);
  });

  it("does not block completed, cancelled, or no_show interviews", () => {
    for (const status of ["completed", "cancelled", "no_show"]) {
      expect(
        isBlockingInterview({ status, endsAt: futureEnd() }, fixedNow)
      ).toBe(false);
    }
  });

  it("does not block when endsAt is missing or invalid", () => {
    expect(isBlockingInterview({ status: "scheduled" }, fixedNow)).toBe(false);
    expect(
      isBlockingInterview({ status: "scheduled", endsAt: "not-a-date" }, fixedNow)
    ).toBe(false);
  });

  it("defaults now to Date.now()", () => {
    expect(
      isBlockingInterview({ status: "scheduled", endsAt: futureEnd() })
    ).toBe(true);
    expect(
      isBlockingInterview({ status: "scheduled", endsAt: pastEnd() })
    ).toBe(false);
  });
});
