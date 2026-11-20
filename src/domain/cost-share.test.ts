import { describe, expect, it } from "vitest";
import {
  applyLiveCeiling,
  CostShareError,
  quoteCostShare,
  UNCONFIGURED,
  type CostConfig,
} from "./cost-share";

const base: CostConfig = {
  costPerKmCents: 1500,
  maxSharePerKmCents: 800,
  platformFeeCents: 0,
  includeDriverInSplit: true,
  splitBasis: "offered_seats",
  ratesLabel: "demo",
};

function quote(over: Partial<CostConfig> = {}, input: Partial<Parameters<typeof quoteCostShare>[1]> = {}) {
  return quoteCostShare(
    { ...base, ...over },
    {
      distanceKm: 20,
      seatsOffered: 3,
      seatsOnThisBooking: 1,
      confirmedSeatsExcludingThis: 0,
      driverOfferPerSeatCents: null,
      ...input,
    },
  );
}

describe("quoteCostShare", () => {
  it("refuses a missing cost rate and a missing cap", () => {
    expect(() => quote({ costPerKmCents: null })).toThrow(CostShareError);
    expect(() => quote({ maxSharePerKmCents: null })).toThrow(CostShareError);
    try {
      quote({ costPerKmCents: null });
    } catch (error) {
      expect(error).toMatchObject({ code: "cost_rate_not_configured" });
    }
    try {
      quote({ maxSharePerKmCents: null });
    } catch (error) {
      expect(error).toMatchObject({ code: "cap_not_configured" });
    }
  });

  it("splits the running cost with the driver and stays under the cap", () => {
    const result = quote();
    expect(result.directCostCents).toBe(30000);
    expect(result.occupants).toBe(4);
    expect(result.uncappedSharePerSeatCents).toBe(7500);
    expect(result.capPerSeatCents).toBe(16000);
    expect(result.payablePerSeatCents).toBe(7500);
    expect(result.capped).toBe(false);
    expect(result.driverReceivesCents).toBe(7500);
    expect(result.payablePerSeatCents * 3).toBeLessThanOrEqual(result.directCostCents);
    expect(result.driverRetainedCostCents).toBe(30000 - 7500 * 3);
  });

  it("clamps a high running cost to the per-kilometre cap", () => {
    const result = quote(
      { costPerKmCents: 2000, maxSharePerKmCents: 500 },
      { distanceKm: 10, seatsOffered: 1 },
    );
    expect(result.directCostCents).toBe(20000);
    expect(result.uncappedSharePerSeatCents).toBe(10000);
    expect(result.capPerSeatCents).toBe(5000);
    expect(result.payablePerSeatCents).toBe(5000);
    expect(result.capped).toBe(true);
    expect(result.driverReceivesCents).toBeLessThan(result.directCostCents);
  });

  it("rejects a driver ask above the formula and accepts a lower ask", () => {
    expect(() => quote({}, { driverOfferPerSeatCents: 8000 })).toThrow(CostShareError);
    const lower = quote({}, { driverOfferPerSeatCents: 1000 });
    expect(lower.payablePerSeatCents).toBe(1000);
    expect(lower.offerApplied).toBe(true);
    const free = quote({}, { driverOfferPerSeatCents: 0 });
    expect(free.payablePerSeatCents).toBe(0);
  });

  it("treats an explicit zero rate as configured and null as not", () => {
    const free = quote({ costPerKmCents: 0, maxSharePerKmCents: 0 });
    expect(free.payablePerSeatCents).toBe(0);
    expect(() => quoteCostShare(UNCONFIGURED, {
      distanceKm: 10,
      seatsOffered: 1,
      seatsOnThisBooking: 1,
      confirmedSeatsExcludingThis: 0,
      driverOfferPerSeatCents: null,
    })).toThrow(CostShareError);
  });

  it("keeps a platform fee out of what the driver receives", () => {
    const result = quote({ platformFeeCents: 250 });
    expect(result.driverReceivesCents).toBe(result.payablePerSeatCents);
    expect(result.passengerPaysCents).toBe(result.payablePerSeatCents + 250);
    expect(result.platformRetainsCents).toBe(250);
    expect(result.platformFeeNeedsLegalReview).toBe(true);
  });

  it("can reimburse the whole running cost only when the driver is left out of the split", () => {
    const result = quote({ includeDriverInSplit: false }, { distanceKm: 10, seatsOffered: 2 });
    expect(result.occupants).toBe(2);
    expect(result.payablePerSeatCents * 2).toBeLessThanOrEqual(result.directCostCents);
    expect(result.driverRetainedCostCents).toBeGreaterThanOrEqual(0);
  });

  it("uses confirmed passengers when that basis is configured", () => {
    const offered = quote({ splitBasis: "offered_seats" }, { seatsOffered: 3 });
    const confirmed = quote({ splitBasis: "confirmed_passengers" }, { seatsOffered: 3, confirmedSeatsExcludingThis: 0 });
    expect(confirmed.passengerSeatsInSplit).toBe(1);
    expect(confirmed.payablePerSeatCents).toBeGreaterThan(offered.payablePerSeatCents);
  });

  it("rejects a non-positive distance and a zero seat count", () => {
    expect(() => quote({}, { distanceKm: 0 })).toThrow(CostShareError);
    expect(() => quote({}, { seatsOffered: 0 })).toThrow(CostShareError);
  });

  it("rounds fractional kilometres to cents and never lets the full split exceed cost", () => {
    const result = quote({ costPerKmCents: 100 }, { distanceKm: 10.006, seatsOffered: 3 });
    expect(result.directCostCents).toBe(1001);
    expect(result.payablePerSeatCents * result.passengerSeatsInSplit).toBeLessThanOrEqual(result.directCostCents);
  });
});

describe("applyLiveCeiling", () => {
  it("does not raise a published quote and does lower it when the live cap drops", () => {
    const published = quote();
    const higher = quote({ costPerKmCents: 4000, maxSharePerKmCents: 3000 });
    const kept = applyLiveCeiling(published, higher);
    expect(kept.ok && kept.tightened).toBe(false);
    expect(kept.ok && kept.result.payablePerSeatCents).toBe(published.payablePerSeatCents);

    const lower = quote({ maxSharePerKmCents: 100 });
    const tightened = applyLiveCeiling(published, lower);
    expect(tightened.ok && tightened.tightened).toBe(true);
    if (tightened.ok) {
      expect(tightened.result.payablePerSeatCents).toBeLessThan(published.payablePerSeatCents);
      expect(tightened.result.payablePerSeatCents).toBeLessThanOrEqual(lower.payablePerSeatCents);
    }
  });

  it("blocks new quotes when the live settings are withdrawn", () => {
    const published = quote();
    expect(applyLiveCeiling(published, null)).toEqual({ ok: false, reason: "settings_withdrawn" });
  });

  it("does not raise the platform fee", () => {
    const published = quote({ platformFeeCents: 100 });
    const higherFee = quote({ platformFeeCents: 900 });
    const kept = applyLiveCeiling(published, higherFee);
    expect(kept.ok && kept.result.platformFeePerSeatCents).toBe(100);
  });
});
