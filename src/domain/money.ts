import { CostShareError } from "./cost-share";

/** Parse a rupee string into cents. Empty is null. Commas are rejected. */
export function parseMurToCents(input: string): number | null | "invalid" {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const MAX_DISTANCE_KM = 150;

export function parseKm(input: string): number | "invalid" {
  const trimmed = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  const km = Number(trimmed);
  if (km <= 0 || km > MAX_DISTANCE_KM) return "invalid";
  return km;
}

export function formatMur(cents: number, locale: "en" | "fr"): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-MU" : "en-MU", {
    style: "currency",
    currency: "MUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function normaliseEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

export function passwordIssue(password: string): "too_short" | null {
  if (password.length < 8) return "too_short";
  return null;
}

export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return `${parts[0]} ${last.slice(0, 1)}.`;
}

export function assertCentsRange(cents: number) {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new CostShareError("invalid_config", "Cents must be a non-negative integer.");
  }
}
