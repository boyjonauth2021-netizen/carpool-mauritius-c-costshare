import { describe, expect, it } from "vitest";
import { fold, haversineKm, matchScore, rideMatches, tokenScore } from "./matching";
import { gazetteerKm, lookupPlace } from "./places";

const ride = {
  originLabel: "Port Louis",
  destinationLabel: "Curepipe",
  originPoint: lookupPlace("Port Louis")?.point,
  destinationPoint: lookupPlace("Curepipe")?.point,
  departureAt: new Date("2026-11-21T03:15:00Z"),
  seatsLeft: 2,
  status: "open",
};

describe("matching", () => {
  it("folds accents and punctuation", () => {
    expect(fold("Ébène")).toBe("ebene");
    expect(tokenScore("Port Louis", "port-louis")).toBe(1);
    expect(tokenScore("Ebène", "Ebene")).toBe(1);
    expect(tokenScore("Grand Baie", "Port Louis")).toBe(0);
  });

  it("matches open trips in the window and skips closed or full ones", () => {
    const query = {
      from: "port louis",
      to: "curepipe",
      earliest: new Date("2026-11-21T00:00:00+04:00"),
      latest: new Date("2026-11-21T23:59:59+04:00"),
    };
    expect(rideMatches(query, ride)).toBe(true);
    expect(rideMatches(query, { ...ride, status: "cancelled" })).toBe(false);
    expect(rideMatches(query, { ...ride, seatsLeft: 0 })).toBe(false);
    expect(rideMatches(query, { ...ride, departureAt: new Date("2026-11-22T03:15:00Z") })).toBe(false);
  });

  it("matches nearby coordinates when the labels differ", () => {
    const near = {
      ...ride,
      originLabel: "Harbour",
      originPoint: { lat: -20.17, lng: 57.51 },
    };
    expect(
      rideMatches(
        { from: "somewhere else", fromPoint: { lat: -20.1609, lng: 57.5012 }, to: "Curepipe" },
        near,
      ),
    ).toBe(true);
    expect(
      rideMatches(
        { from: "Mahebourg", fromPoint: lookupPlace("Mahebourg")?.point, to: "Curepipe" },
        near,
      ),
    ).toBe(false);
  });

  it("scores a closer text match above a weak one", () => {
    const exact = matchScore({ from: "Port Louis", to: "Curepipe" }, ride);
    const weak = matchScore({ from: "Port", to: "Curepipe" }, ride);
    expect(exact).toBeGreaterThan(weak);
  });

  it("measures a short hop inside Mauritius", () => {
    const portLouis = lookupPlace("Port Louis");
    const curepipe = lookupPlace("Curepipe");
    expect(portLouis && curepipe).toBeTruthy();
    if (portLouis && curepipe) {
      const line = haversineKm(portLouis.point, curepipe.point);
      expect(line).toBeGreaterThan(10);
      expect(line).toBeLessThan(30);
    }
  });
});

describe("gazetteer", () => {
  it("estimates a road distance and rejects unknown places", () => {
    const km = gazetteerKm("Curepipe", "Port Louis");
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(15);
    expect(km!).toBeLessThan(40);
    expect(gazetteerKm("Ebène", "Ebene")).toBeNull();
    expect(gazetteerKm("Atlantis", "Port Louis")).toBeNull();
    expect(lookupPlace("Mahébourg")?.name).toBe("Mahebourg");
  });
});
