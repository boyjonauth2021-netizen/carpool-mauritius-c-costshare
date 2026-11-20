import { describe, expect, it } from "vitest";
import { formatMur, normaliseEmail, parseKm, parseMurToCents, passwordIssue, publicName } from "./money";
import { formatMauritius, mauritiusDayRange, mauritiusTodayIso, parseMauritiusLocal } from "./time";
import { canSeePhone, documentStillValid } from "./policy";
import { parseHash } from "@/demo/hash";
import { estimateTripDistance, mockSms, recordOfflineShare } from "@/adapters/mocks";

describe("money and time", () => {
  it("parses rupees and kilometres without guessing", () => {
    expect(parseMurToCents("12")).toBe(1200);
    expect(parseMurToCents("12.5")).toBe(1250);
    expect(parseMurToCents("12.50")).toBe(1250);
    expect(parseMurToCents("")).toBeNull();
    expect(parseMurToCents("12,50")).toBe("invalid");
    expect(parseMurToCents("-1")).toBe("invalid");
    expect(parseKm("18,5")).toBe(18.5);
    expect(parseKm("0")).toBe("invalid");
    expect(parseKm("200")).toBe("invalid");
  });

  it("formats rupees and Mauritius civil time", () => {
    expect(formatMur(1250, "en")).toContain("12.50");
    expect(formatMur(1250, "fr")).toMatch(/12,50/);
    const morning = parseMauritiusLocal("2026-06-01T08:00");
    expect(morning?.toISOString()).toBe("2026-06-01T04:00:00.000Z");
    expect(mauritiusTodayIso(new Date("2026-06-01T04:00:00.000Z"))).toBe("2026-06-01");
    expect(formatMauritius(morning!, "en")).toContain("08:00");
    expect(mauritiusDayRange("2026-06-01")?.earliest.toISOString()).toBe("2026-05-31T20:00:00.000Z");
    expect(parseMauritiusLocal("tomorrow")).toBeNull();
  });

  it("checks emails, passwords, names, documents, and phone visibility", () => {
    expect(normaliseEmail(" A@B.COM ")).toBe("a@b.com");
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(passwordIssue("short")).toBe("too_short");
    expect(passwordIssue("demo-pass")).toBeNull();
    expect(publicName("Kevin Boyjonauth")).toBe("Kevin B.");
    expect(documentStillValid("2026-06-01", "2026-06-01")).toBe(true);
    expect(documentStillValid("2026-05-31", "2026-06-01")).toBe(false);
    expect(
      canSeePhone({
        viewerId: "a",
        driverId: "a",
        passengerId: "b",
        bookingStatus: "requested",
      }),
    ).toBe(false);
    expect(
      canSeePhone({
        viewerId: "b",
        driverId: "a",
        passengerId: "b",
        bookingStatus: "accepted",
      }),
    ).toBe(true);
  });
});

describe("hash and mock adapters", () => {
  it("reads hash routes", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/rides/new")).toEqual({ name: "new-ride" });
    expect(parseHash("#/rides/ride_curepipe")).toEqual({ name: "ride", id: "ride_curepipe" });
    expect(parseHash("#/admin/settings")).toEqual({ name: "settings" });
    expect(parseHash("#/nope")).toEqual({ name: "home" });
  });

  it("keeps maps, SMS, and settlement inside the browser", () => {
    const distance = estimateTripDistance("Curepipe", "Port Louis", "");
    expect(distance.ok).toBe(true);
    if (distance.ok) expect(distance.source).toBe("gazetteer");
    expect(estimateTripDistance("Atlantis", "Port Louis", "").ok).toBe(false);
    expect(estimateTripDistance("Atlantis", "Port Louis", "12.5")).toEqual({
      ok: true,
      km: 12.5,
      source: "manual",
    });
    const sms = mockSms("+23051234400", "123456");
    expect(sms.delivered).toBe(false);
    expect(sms.provider).toBe("mock-sms");
    expect(recordOfflineShare()).toEqual({
      provider: "none",
      moneyMoved: false,
      method: "offline-acknowledgement",
    });
  });
});
