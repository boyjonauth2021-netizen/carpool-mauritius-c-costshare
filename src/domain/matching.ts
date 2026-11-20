export type LatLng = { lat: number; lng: number };

export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenScore(a: string, b: string): number {
  const left = new Set(fold(a).split(" ").filter(Boolean));
  const right = new Set(fold(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

const EARTH_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export type RideCandidate = {
  originLabel: string;
  destinationLabel: string;
  originPoint?: LatLng | null;
  destinationPoint?: LatLng | null;
  departureAt: Date;
  seatsLeft: number;
  status: string;
};

export type RideQuery = {
  from?: string;
  to?: string;
  fromPoint?: LatLng | null;
  toPoint?: LatLng | null;
  earliest?: Date | null;
  latest?: Date | null;
};

export type MatchOptions = {
  textThreshold: number;
  radiusKm: number;
};

export const DEFAULT_MATCH: MatchOptions = {
  textThreshold: 0.5,
  radiusKm: 8,
};

function placeMatches(
  queryText: string | undefined,
  label: string,
  ridePoint: LatLng | null | undefined,
  queryPoint: LatLng | null | undefined,
  options: MatchOptions,
): boolean {
  if (!queryText || !queryText.trim()) return true;
  if (tokenScore(queryText, label) >= options.textThreshold) return true;
  if (queryPoint && ridePoint && haversineKm(queryPoint, ridePoint) <= options.radiusKm) return true;
  return false;
}

export function rideMatches(query: RideQuery, ride: RideCandidate, options: MatchOptions = DEFAULT_MATCH): boolean {
  if (ride.status !== "open") return false;
  if (ride.seatsLeft < 1) return false;
  if (query.earliest && ride.departureAt < query.earliest) return false;
  if (query.latest && ride.departureAt > query.latest) return false;
  if (!placeMatches(query.from, ride.originLabel, ride.originPoint, query.fromPoint, options)) return false;
  if (!placeMatches(query.to, ride.destinationLabel, ride.destinationPoint, query.toPoint, options)) return false;
  return true;
}

export function matchScore(query: RideQuery, ride: RideCandidate): number {
  const origin = query.from ? tokenScore(query.from, ride.originLabel) : 0.5;
  const destination = query.to ? tokenScore(query.to, ride.destinationLabel) : 0.5;
  let time = 0.5;
  if (query.earliest && query.latest) {
    const mid = query.earliest.getTime() + (query.latest.getTime() - query.earliest.getTime()) / 2;
    const windowMinutes = Math.max(1, (query.latest.getTime() - query.earliest.getTime()) / 60000);
    const diffMinutes = Math.abs(ride.departureAt.getTime() - mid) / 60000;
    time = Math.max(0, 1 - diffMinutes / windowMinutes);
  }
  return origin + destination + time;
}
