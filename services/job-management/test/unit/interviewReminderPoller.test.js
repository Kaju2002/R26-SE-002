import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReminderWindows } from "../../jobs/interviewReminderPoller.js";

describe("getReminderWindows", () => {
  const original = process.env.INTERVIEW_REMINDER_TEST_MODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.INTERVIEW_REMINDER_TEST_MODE;
    } else {
      process.env.INTERVIEW_REMINDER_TEST_MODE = original;
    }
  });

  it("returns 24h and 1h windows in normal mode", () => {
    delete process.env.INTERVIEW_REMINDER_TEST_MODE;
    const windows = getReminderWindows();

    expect(windows).toHaveLength(2);
    expect(windows[0].key).toBe("24h");
    expect(windows[1].key).toBe("1h");
    expect(windows[0].offsetMs).toBe(24 * 60 * 60 * 1000);
    expect(windows[1].offsetMs).toBe(60 * 60 * 1000);
  });

  it("returns short windows when test mode is enabled", () => {
    process.env.INTERVIEW_REMINDER_TEST_MODE = "true";
    const windows = getReminderWindows();

    expect(windows[0].label).toMatch(/5 minutes/i);
    expect(windows[1].label).toMatch(/2 minutes/i);
    expect(windows[0].offsetMs).toBe(5 * 60 * 1000);
    expect(windows[1].offsetMs).toBe(2 * 60 * 1000);
  });
});
