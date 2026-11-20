import { gazetteerKm } from "@/domain/places";
import { parseKm } from "@/domain/money";

/**
 * Static-demo adapters. Nothing here calls a network.
 * A future server build can replace these without changing the cost-share formula.
 */

export type DistanceEstimate =
  | { ok: true; km: number; source: "gazetteer" | "manual" }
  | { ok: false; reason: "unknown_place" | "invalid_distance" };

export function estimateTripDistance(origin: string, destination: string, manualKm: string): DistanceEstimate {
  const typed = manualKm.trim();
  if (typed) {
    const km = parseKm(typed);
    if (km === "invalid") return { ok: false, reason: "invalid_distance" };
    return { ok: true, km, source: "manual" };
  }
  const km = gazetteerKm(origin, destination);
  if (km === null) return { ok: false, reason: "unknown_place" };
  return { ok: true, km, source: "gazetteer" };
}

export type MockSms = {
  to: string;
  code: string;
  body: string;
  provider: "mock-sms";
  delivered: false;
};

export function mockSms(to: string, code: string): MockSms {
  return {
    to,
    code,
    body: `Carpool Mauritius demo code ${code}. This SMS was not sent.`,
    provider: "mock-sms",
    delivered: false,
  };
}

export type MockEmail = {
  toUserId: string;
  subject: string;
  body: string;
  provider: "mock-email";
  delivered: false;
};

export function mockEmail(toUserId: string, subject: string, body: string): MockEmail {
  return { toUserId, subject, body, provider: "mock-email", delivered: false };
}

export type OfflineShareRecord = {
  provider: "none";
  moneyMoved: false;
  method: "offline-acknowledgement";
};

export function recordOfflineShare(): OfflineShareRecord {
  return { provider: "none", moneyMoved: false, method: "offline-acknowledgement" };
}

export function mapsBrowserKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}
