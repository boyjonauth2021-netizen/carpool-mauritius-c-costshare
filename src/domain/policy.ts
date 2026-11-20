export const MIN_LEAD_MINUTES = 30;
export const SEARCH_HORIZON_DAYS = 14;

export type Gate = { ok: true } | { ok: false; reason: string };

export function seatsLeft(offered: number, held: number): number {
  return Math.max(0, offered - held);
}

export function canSeePhone(input: {
  viewerId: string;
  driverId: string;
  passengerId: string;
  bookingStatus: string;
}): boolean {
  const party = input.viewerId === input.driverId || input.viewerId === input.passengerId;
  return party && input.bookingStatus === "accepted";
}

export function documentStillValid(expiryIso: string, todayIso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(expiryIso) && expiryIso >= todayIso;
}
