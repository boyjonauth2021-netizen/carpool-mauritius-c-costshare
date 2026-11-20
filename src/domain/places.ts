import { fold, haversineKm, type LatLng } from "./matching";

/** Demo gazetteer. Road distance is straight-line times a factor, not a surveyed route. */
export const ROAD_FACTOR = 1.35;

export const PLACES: { name: string; point: LatLng }[] = [
  { name: "Port Louis", point: { lat: -20.1609, lng: 57.5012 } },
  { name: "Curepipe", point: { lat: -20.3189, lng: 57.5266 } },
  { name: "Quatre Bornes", point: { lat: -20.2638, lng: 57.4791 } },
  { name: "Vacoas", point: { lat: -20.2981, lng: 57.4783 } },
  { name: "Rose Hill", point: { lat: -20.2354, lng: 57.4686 } },
  { name: "Beau Bassin", point: { lat: -20.223, lng: 57.468 } },
  { name: "Ebene", point: { lat: -20.244, lng: 57.489 } },
  { name: "Grand Baie", point: { lat: -20.013, lng: 57.583 } },
  { name: "Triolet", point: { lat: -20.055, lng: 57.546 } },
  { name: "Centre de Flacq", point: { lat: -20.19, lng: 57.714 } },
  { name: "Mahebourg", point: { lat: -20.408, lng: 57.7 } },
  { name: "Souillac", point: { lat: -20.517, lng: 57.521 } },
  { name: "Flic en Flac", point: { lat: -20.274, lng: 57.363 } },
  { name: "Tamarin", point: { lat: -20.326, lng: 57.371 } },
  { name: "Moka", point: { lat: -20.219, lng: 57.496 } },
  { name: "Reduit", point: { lat: -20.234, lng: 57.497 } },
  { name: "Belle Mare", point: { lat: -20.071, lng: 57.704 } },
  { name: "Goodlands", point: { lat: -20.035, lng: 57.646 } },
  { name: "Pamplemousses", point: { lat: -20.106, lng: 57.58 } },
  { name: "Terre Rouge", point: { lat: -20.126, lng: 57.524 } },
  { name: "Black River", point: { lat: -20.36, lng: 57.366 } },
  { name: "Le Morne", point: { lat: -20.45, lng: 57.317 } },
];

const ALIASES: Record<string, string> = {
  ebene: "Ebene",
  "ebene cybercity": "Ebene",
  mahebourg: "Mahebourg",
  reduit: "Reduit",
  "vacoas phoenix": "Vacoas",
  "quatre bornes": "Quatre Bornes",
  "grand baie": "Grand Baie",
  "port louis": "Port Louis",
  "flic en flac": "Flic en Flac",
  "centre de flacq": "Centre de Flacq",
  "belle mare": "Belle Mare",
  "le morne": "Le Morne",
  "black river": "Black River",
  "rose hill": "Rose Hill",
  "beau bassin": "Beau Bassin",
  "terre rouge": "Terre Rouge",
};

export function lookupPlace(label: string): { name: string; point: LatLng } | null {
  const folded = fold(label);
  if (!folded) return null;
  const alias = ALIASES[folded];
  const target = alias ? fold(alias) : folded;
  return PLACES.find((place) => fold(place.name) === target) ?? null;
}

export function gazetteerKm(origin: string, destination: string): number | null {
  const from = lookupPlace(origin);
  const to = lookupPlace(destination);
  if (!from || !to) return null;
  if (from.name === to.name) return null;
  const road = haversineKm(from.point, to.point) * ROAD_FACTOR;
  return Math.round(road * 10) / 10;
}
