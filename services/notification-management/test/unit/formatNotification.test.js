import { describe, expect, it } from "vitest";
import {
  buildLogoFallback,
  formatApplicationNotification,
  formatGeneralNotification,
  formatNotification,
  formatNotificationList,
} from "../../utils/formatNotification.js";

describe("buildLogoFallback", () => {
  it("returns initials for company names", () => {
    const fallback = buildLogoFallback("Acme Labs");
    expect(fallback.text).toBe("AL");
    expect(fallback.bg).toMatch(/^#/);
  });

  it("returns undefined for blank names", () => {
    expect(buildLogoFallback("")).toBeUndefined();
  });
});

describe("formatGeneralNotification", () => {
  it("shapes general notifications for the mobile UI", () => {
    const formatted = formatGeneralNotification({
      _id: "507f1f77bcf86cd799439011",
      category: "general",
      type: "support",
      title: "Support replied",
      body: "We replied to your ticket",
      read: false,
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      metadata: {
        ticketId: "ticket-1",
        ticketNumber: "TK-001",
        flagged: true,
      },
    });

    expect(formatted.id).toBe("507f1f77bcf86cd799439011");
    expect(formatted.category).toBe("general");
    expect(formatted.ticketId).toBe("ticket-1");
    expect(formatted.ticketNumber).toBe("TK-001");
    expect(formatted.flagged).toBe(true);
    expect(formatted.date).toBeTruthy();
    expect(formatted.time).toBeTruthy();
  });
});

describe("formatApplicationNotification", () => {
  it("uses logo fallback when company logo is missing", () => {
    const formatted = formatApplicationNotification({
      _id: "507f1f77bcf86cd799439012",
      title: "Application Update",
      read: true,
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      metadata: {
        jobTitle: "Analyst",
        companyName: "Acme Ltd",
        applicationStatus: "shortlisted",
      },
    });

    expect(formatted.jobTitle).toBe("Analyst");
    expect(formatted.status).toBe("shortlisted");
    expect(formatted.companyFallback?.text).toBe("AL");
    expect(formatted.read).toBe(true);
  });
});

describe("formatNotification", () => {
  it("routes application category to application formatter", () => {
    const formatted = formatNotification({
      _id: "507f1f77bcf86cd799439013",
      category: "applications",
      metadata: { jobTitle: "Dev", companyName: "Acme" },
      read: false,
    });

    expect(formatted.jobTitle).toBe("Dev");
    expect(formatted.companyName).toBe("Acme");
  });

  it("routes other categories to general formatter", () => {
    const formatted = formatNotification({
      _id: "507f1f77bcf86cd799439014",
      category: "general",
      type: "auth",
      title: "Password Updated",
      body: "Done",
      read: false,
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      metadata: {},
    });

    expect(formatted.title).toBe("Password Updated");
    expect(formatted.category).toBe("general");
  });
});

describe("formatNotificationList", () => {
  it("maps each notification through formatNotification", () => {
    const list = formatNotificationList([
      {
        _id: "1",
        category: "applications",
        metadata: { jobTitle: "A", companyName: "B" },
        read: false,
      },
      {
        _id: "2",
        category: "general",
        type: "system",
        title: "Hi",
        body: "Body",
        read: true,
        createdAt: new Date("2026-08-29T10:00:00.000Z"),
        metadata: {},
      },
    ]);

    expect(list).toHaveLength(2);
    expect(list[0].jobTitle).toBe("A");
    expect(list[1].title).toBe("Hi");
  });
});
