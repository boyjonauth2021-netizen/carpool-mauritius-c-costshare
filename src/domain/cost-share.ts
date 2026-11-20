/** Version C cost share. Money is integer cents. Null rates are not zero. */

export const FORMULA_VERSION = "c-cost-share-v1" as const;

export type CostShareErrorCode =
  | "cost_rate_not_configured"
  | "cap_not_configured"
  | "invalid_distance"
  | "invalid_seats"
  | "invalid_config"
  | "offer_exceeds_cap";

export class CostShareError extends Error {
  readonly code: CostShareErrorCode;

  constructor(code: CostShareErrorCode, message: string) {
    super(message);
    this.name = "CostShareError";
    this.code = code;
  }
}

export type RatesLabel = "unconfigured" | "demo" | "operator";
export type SplitBasis = "offered_seats" | "confirmed_passengers";

export type CostConfig = {
  costPerKmCents: number | null;
  maxSharePerKmCents: number | null;
  platformFeeCents: number;
  includeDriverInSplit: boolean;
  splitBasis: SplitBasis;
  ratesLabel: RatesLabel;
};

export type QuoteInput = {
  distanceKm: number;
  seatsOffered: number;
  seatsOnThisBooking: number;
  confirmedSeatsExcludingThis: number;
  driverOfferPerSeatCents: number | null;
};

export type CostShareResult = {
  formulaVersion: typeof FORMULA_VERSION;
  directCostCents: number;
  occupants: number;
  passengerSeatsInSplit: number;
  uncappedSharePerSeatCents: number;
  capPerSeatCents: number;
  formulaSharePerSeatCents: number;
  payablePerSeatCents: number;
  platformFeePerSeatCents: number;
  seatsOnThisBooking: number;
  passengerPaysCents: number;
  driverReceivesCents: number;
  platformRetainsCents: number;
  driverRetainedCostCents: number;
  capped: boolean;
  clampedToCost: boolean;
  offerApplied: boolean;
  platformFeeNeedsLegalReview: boolean;
  ratesLabel: RatesLabel;
  tightened: boolean;
};

export type RideSnapshot = {
  formulaVersion: typeof FORMULA_VERSION;
  distanceKm: number;
  seatsOffered: number;
  driverOfferPerSeatCents: number | null;
  config: CostConfig;
};

export const UNCONFIGURED: CostConfig = {
  costPerKmCents: null,
  maxSharePerKmCents: null,
  platformFeeCents: 0,
  includeDriverInSplit: true,
  splitBasis: "offered_seats",
  ratesLabel: "unconfigured",
};

function assertCents(value: number, code: CostShareErrorCode, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 100_000_000) {
    throw new CostShareError(code, `${label} must be a non-negative whole number of cents.`);
  }
}

function assertConfig(config: CostConfig) {
  if (config.costPerKmCents !== null) {
    assertCents(config.costPerKmCents, "invalid_config", "Cost per km");
  }
  if (config.maxSharePerKmCents !== null) {
    assertCents(config.maxSharePerKmCents, "invalid_config", "Cap per km");
  }
  assertCents(config.platformFeeCents, "invalid_config", "Platform fee");
  if (config.splitBasis !== "offered_seats" && config.splitBasis !== "confirmed_passengers") {
    throw new CostShareError("invalid_config", "Unknown split basis.");
  }
  if (config.includeDriverInSplit !== true && config.includeDriverInSplit !== false) {
    throw new CostShareError("invalid_config", "includeDriverInSplit must be boolean.");
  }
}

export function settingsReady(config: CostConfig): boolean {
  return config.costPerKmCents !== null && config.maxSharePerKmCents !== null;
}

export function quoteCostShare(config: CostConfig, input: QuoteInput): CostShareResult {
  assertConfig(config);
  if (config.costPerKmCents === null) {
    throw new CostShareError(
      "cost_rate_not_configured",
      "No running-cost rate is configured.",
    );
  }
  if (config.maxSharePerKmCents === null) {
    throw new CostShareError("cap_not_configured", "No cost-share cap is configured.");
  }
  if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) {
    throw new CostShareError("invalid_distance", "Distance must be a positive number of kilometres.");
  }
  if (!Number.isInteger(input.seatsOffered) || input.seatsOffered < 1 || input.seatsOffered > 12) {
    throw new CostShareError("invalid_seats", "Seats offered must be a whole number from 1 to 12.");
  }
  if (
    !Number.isInteger(input.seatsOnThisBooking) ||
    input.seatsOnThisBooking < 1 ||
    input.seatsOnThisBooking > input.seatsOffered
  ) {
    throw new CostShareError("invalid_seats", "Seats on this booking must fit the seats offered.");
  }
  if (!Number.isInteger(input.confirmedSeatsExcludingThis) || input.confirmedSeatsExcludingThis < 0) {
    throw new CostShareError("invalid_seats", "Confirmed seats must be a non-negative whole number.");
  }
  if (input.driverOfferPerSeatCents !== null) {
    assertCents(input.driverOfferPerSeatCents, "invalid_config", "Driver offer");
  }

  const passengerSeatsInSplit =
    config.splitBasis === "offered_seats"
      ? input.seatsOffered
      : input.confirmedSeatsExcludingThis + input.seatsOnThisBooking;

  if (passengerSeatsInSplit < 1) {
    throw new CostShareError("invalid_seats", "The split needs at least one passenger seat.");
  }

  const occupants = passengerSeatsInSplit + (config.includeDriverInSplit ? 1 : 0);
  const directCostCents = Math.round(input.distanceKm * config.costPerKmCents);
  const capPerSeatCents = Math.round(input.distanceKm * config.maxSharePerKmCents);
  const uncappedSharePerSeatCents = Math.floor(directCostCents / occupants);
  const noProfitCeiling = Math.floor(directCostCents / passengerSeatsInSplit);
  const formulaSharePerSeatCents = Math.min(
    uncappedSharePerSeatCents,
    capPerSeatCents,
    noProfitCeiling,
  );

  let payable = formulaSharePerSeatCents;
  let offerApplied = false;
  if (input.driverOfferPerSeatCents !== null) {
    if (input.driverOfferPerSeatCents > formulaSharePerSeatCents) {
      throw new CostShareError(
        "offer_exceeds_cap",
        "The amount the driver asks per seat is above the capped cost share.",
      );
    }
    payable = input.driverOfferPerSeatCents;
    offerApplied = true;
  }

  const filled = payable * passengerSeatsInSplit;
  if (filled > directCostCents) {
    throw new CostShareError("invalid_config", "Quote would pay the driver more than the running cost.");
  }

  return {
    formulaVersion: FORMULA_VERSION,
    directCostCents,
    occupants,
    passengerSeatsInSplit,
    uncappedSharePerSeatCents,
    capPerSeatCents,
    formulaSharePerSeatCents,
    payablePerSeatCents: payable,
    platformFeePerSeatCents: config.platformFeeCents,
    seatsOnThisBooking: input.seatsOnThisBooking,
    passengerPaysCents: (payable + config.platformFeeCents) * input.seatsOnThisBooking,
    driverReceivesCents: payable * input.seatsOnThisBooking,
    platformRetainsCents: config.platformFeeCents * input.seatsOnThisBooking,
    driverRetainedCostCents: directCostCents - filled,
    capped: capPerSeatCents < uncappedSharePerSeatCents && formulaSharePerSeatCents === capPerSeatCents,
    clampedToCost: noProfitCeiling < Math.min(uncappedSharePerSeatCents, capPerSeatCents),
    offerApplied,
    platformFeeNeedsLegalReview: config.platformFeeCents > 0,
    ratesLabel: config.ratesLabel,
    tightened: false,
  };
}

export type TightenedQuote =
  | { ok: true; result: CostShareResult; tightened: boolean }
  | { ok: false; reason: "settings_withdrawn" };

/** A later lower cap or fee replaces the published quote. A later higher quote does not. */
export function applyLiveCeiling(
  published: CostShareResult,
  live: CostShareResult | null,
): TightenedQuote {
  if (!live) return { ok: false, reason: "settings_withdrawn" };
  const payable = Math.min(published.payablePerSeatCents, live.payablePerSeatCents);
  const fee = Math.min(published.platformFeePerSeatCents, live.platformFeePerSeatCents);
  const tightened = payable < published.payablePerSeatCents || fee < published.platformFeePerSeatCents;
  if (!tightened) return { ok: true, result: published, tightened: false };

  const seats = published.seatsOnThisBooking;
  const passengerSeats = published.passengerSeatsInSplit;
  let payableClamped = payable;
  if (passengerSeats > 0 && payableClamped * passengerSeats > published.directCostCents) {
    payableClamped = Math.floor(published.directCostCents / passengerSeats);
  }

  return {
    ok: true,
    tightened: true,
    result: {
      ...published,
      payablePerSeatCents: payableClamped,
      platformFeePerSeatCents: fee,
      passengerPaysCents: (payableClamped + fee) * seats,
      driverReceivesCents: payableClamped * seats,
      platformRetainsCents: fee * seats,
      driverRetainedCostCents: published.directCostCents - payableClamped * passengerSeats,
      offerApplied: published.offerApplied || payableClamped < published.formulaSharePerSeatCents,
      platformFeeNeedsLegalReview: fee > 0,
      tightened: true,
      ratesLabel: live.ratesLabel,
    },
  };
}

export function previewShare(
  snapshot: RideSnapshot,
  liveConfig: CostConfig,
  seatsOnThisBooking: number,
  confirmedSeatsExcludingThis: number,
):
  | { ok: true; result: CostShareResult; tightened: boolean }
  | { ok: false; error: CostShareErrorCode | "settings_withdrawn" } {
  const input: QuoteInput = {
    distanceKm: snapshot.distanceKm,
    seatsOffered: snapshot.seatsOffered,
    seatsOnThisBooking,
    confirmedSeatsExcludingThis,
    driverOfferPerSeatCents: snapshot.driverOfferPerSeatCents,
  };
  let published: CostShareResult;
  try {
    published = quoteCostShare(snapshot.config, input);
  } catch (error) {
    if (error instanceof CostShareError) return { ok: false, error: error.code };
    throw error;
  }
  let live: CostShareResult | null;
  try {
    live = quoteCostShare(liveConfig, input);
  } catch (error) {
    if (
      error instanceof CostShareError &&
      (error.code === "cap_not_configured" || error.code === "cost_rate_not_configured")
    ) {
      live = null;
    } else if (error instanceof CostShareError) {
      return { ok: false, error: error.code };
    } else {
      throw error;
    }
  }
  const ceiling = applyLiveCeiling(published, live);
  if (!ceiling.ok) return { ok: false, error: ceiling.reason };
  return { ok: true, result: ceiling.result, tightened: ceiling.tightened };
}
