import { describe, expect, it } from "vitest";
import { quoteCostShare } from "@/domain/cost-share";
import { addMauritiusDays } from "@/domain/time";
import { loadOrSeed, memoryStorage } from "./persist";
import { reduce } from "./reduce";
import { DEMO_PASSWORD, seed } from "./seed";
import type { DemoState } from "./types";

const now = new Date("2026-11-20T06:00:00.000Z");

function asUser(state: DemoState, userId: string) {
  const signed = reduce(state, { type: "login_as", userId }, now);
  expect(signed.error).toBeUndefined();
  return signed.state;
}

describe("demo flow", () => {
  it("seeds a capped quote and a full request-accept path", () => {
    let state = seed(now);
    const ride = state.rides.find((item) => item.id === "ride_qb");
    expect(ride).toBeTruthy();
    const preview = quoteCostShare(ride!.snapshot.config, {
      distanceKm: ride!.distanceKm,
      seatsOffered: ride!.seatsOffered,
      seatsOnThisBooking: 1,
      confirmedSeatsExcludingThis: 0,
      driverOfferPerSeatCents: null,
    });
    expect(preview.payablePerSeatCents).toBeLessThanOrEqual(preview.capPerSeatCents);
    expect(preview.driverReceivesCents).toBeLessThanOrEqual(preview.directCostCents);
    expect(state.settings.ratesLabel).toBe("demo");

    state = asUser(state, "user_passenger");
    const requested = reduce(state, { type: "request_seat", rideId: "ride_qb", seats: 1 }, now);
    expect(requested.notice).toBe("requested");
    const booking = requested.state.bookings.find((item) => item.rideId === "ride_qb");
    expect(booking?.status).toBe("requested");
    expect(booking?.locked).toBeNull();

    state = asUser(requested.state, "user_driver");
    const accepted = reduce(state, { type: "accept", bookingId: booking!.id }, now);
    expect(accepted.notice).toBe("accepted");
    const locked = accepted.state.bookings.find((item) => item.id === booking!.id);
    expect(locked?.status).toBe("accepted");
    expect(locked?.locked?.payablePerSeatCents).toBeLessThanOrEqual(locked!.locked!.capPerSeatCents);
    expect(locked?.locked?.driverReceivesCents).toBeLessThanOrEqual(locked!.locked!.directCostCents);
    expect(accepted.state.inbox.some((item) => item.toUserId === "user_passenger" && item.subject === "Seat confirmed")).toBe(true);

    const passengerView = asUser(accepted.state, "user_passenger");
    const marked = reduce(passengerView, { type: "mark_handover", bookingId: booking!.id, side: "passenger" }, now);
    expect(marked.notice).toBe("marked");
    expect(marked.state.audits[0]?.action).toBe("offline_share_marked");
    expect(JSON.parse(marked.state.audits[0]?.payload ?? "{}").moneyMoved).toBe(false);
  });

  it("blocks an unverified driver, an excessive ask, and a withdrawn cap", () => {
    let state = asUser(seed(now), "user_pending");
    const blocked = reduce(
      state,
      {
        type: "post_ride",
        origin: "Moka",
        destination: "Port Louis",
        departureLocal: "2026-11-21T09:00",
        seatsOffered: 1,
        note: "",
        offerPerSeat: "",
        manualKm: "",
      },
      now,
    );
    expect(blocked.error).toBe("not_verified");

    state = asUser(seed(now), "user_admin");
    const approved = reduce(state, { type: "review", userId: "user_pending", decision: "approved", reason: "" }, now);
    expect(approved.notice).toBe("reviewed");
    expect(approved.state.users.find((user) => user.id === "user_pending")?.driver?.status).toBe("approved");

    state = asUser(approved.state, "user_driver");
    const tooHigh = reduce(
      state,
      {
        type: "post_ride",
        origin: "Curepipe",
        destination: "Port Louis",
        departureLocal: "2026-11-21T09:30",
        seatsOffered: 1,
        note: "Morning",
        offerPerSeat: "500",
        manualKm: "",
      },
      now,
    );
    expect(tooHigh.error).toBe("offer_exceeds_cap");

    state = asUser(seed(now), "user_admin");
    const cleared = reduce(state, { type: "clear_settings" }, now);
    expect(cleared.state.settings.costPerKmCents).toBeNull();
    state = asUser(cleared.state, "user_passenger");
    const withdrawn = reduce(state, { type: "request_seat", rideId: "ride_baie", seats: 1 }, now);
    expect(withdrawn.error).toBe("settings_withdrawn");
  });

  it("registers with the mock OTP and refuses a save without the acknowledgement", () => {
    let state = seed(now);
    const sent = reduce(state, { type: "send_otp", phone: "+230 5988 1111" }, now);
    expect(sent.notice).toBe("otp_sent");
    expect(sent.state.otp?.code).toMatch(/^\d{6}$/);
    const registered = reduce(
      sent.state,
      {
        type: "register",
        name: "Nadine Appadoo",
        email: "nadine@bojo.demo",
        password: DEMO_PASSWORD,
        phone: "+230 5988 1111",
        role: "passenger",
        code: sent.state.otp!.code,
      },
      now,
    );
    expect(registered.notice).toBe("registered");
    expect(registered.state.sessionUserId).toBeTruthy();

    state = asUser(registered.state, "user_admin");
    const denied = reduce(
      state,
      {
        type: "save_settings",
        costPerKm: "10",
        maxSharePerKm: "4",
        platformFee: "0",
        includeDriverInSplit: true,
        splitBasis: "offered_seats",
        acknowledged: false,
      },
      now,
    );
    expect(denied.error).toBe("ack_required");
    const saved = reduce(
      state,
      {
        type: "save_settings",
        costPerKm: "10.00",
        maxSharePerKm: "4.00",
        platformFee: "0",
        includeDriverInSplit: true,
        splitBasis: "offered_seats",
        acknowledged: true,
      },
      now,
    );
    expect(saved.state.settings.ratesLabel).toBe("operator");
    expect(saved.state.settings.maxSharePerKmCents).toBe(400);
  });

  it("lowers an accepted quote when the cap was tightened after the request", () => {
    let state = asUser(seed(now), "user_passenger");
    state = reduce(state, { type: "request_seat", rideId: "ride_baie", seats: 1 }, now).state;
    const bookingId = state.bookings.find((item) => item.rideId === "ride_baie")!.id;
    const quoted = state.bookings[0]!.quoted.payablePerSeatCents;
    state = asUser(state, "user_admin");
    state = reduce(
      state,
      {
        type: "save_settings",
        costPerKm: "15",
        maxSharePerKm: "1",
        platformFee: "0",
        includeDriverInSplit: true,
        splitBasis: "offered_seats",
        acknowledged: true,
      },
      now,
    ).state;
    state = asUser(state, "user_driver");
    const accepted = reduce(state, { type: "accept", bookingId }, now);
    expect(accepted.notice).toBe("accepted");
    const locked = accepted.state.bookings.find((item) => item.id === bookingId)!.locked!;
    expect(locked.payablePerSeatCents).toBeLessThan(quoted);
    expect(locked.tightened).toBe(true);
  });

  it("reloads a saved blob and reseeds a bad one", () => {
    const storage = memoryStorage();
    const first = loadOrSeed(now, storage);
    expect(first.users).toHaveLength(4);
    first.locale = "fr";
    storage.setItem("carpool-mauritius-c:v1", JSON.stringify({ version: 1, state: first }));
    expect(loadOrSeed(now, storage).locale).toBe("fr");
    storage.setItem("carpool-mauritius-c:v1", "{");
    expect(loadOrSeed(now, storage).locale).toBe("en");
    expect(addMauritiusDays(now, 1, 7, 15).toISOString().endsWith("Z")).toBe(true);
  });
});
