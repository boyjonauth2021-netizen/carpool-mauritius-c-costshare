import { mockEmail, mockSms, recordOfflineShare, estimateTripDistance } from "@/adapters/mocks";
import {
  FORMULA_VERSION,
  previewShare,
  quoteCostShare,
  settingsReady,
  UNCONFIGURED,
  type CostConfig,
  type RideSnapshot,
} from "@/domain/cost-share";
import { normaliseEmail, parseMurToCents, passwordIssue } from "@/domain/money";
import { documentStillValid, MIN_LEAD_MINUTES, seatsLeft } from "@/domain/policy";
import { gazetteerKm } from "@/domain/places";
import { mauritiusTodayIso, parseMauritiusLocal } from "@/domain/time";
import { DEMO_RATES, seed } from "./seed";
import type { Action, Booking, DemoState, ErrorCode, ReduceResult, User } from "./types";

function fail(state: DemoState, error: ErrorCode): ReduceResult {
  return { state, error };
}

function ok(state: DemoState, notice?: ReduceResult["notice"]): ReduceResult {
  return notice ? { state, notice } : { state };
}

function current(state: DemoState): User | null {
  return state.users.find((user) => user.id === state.sessionUserId) ?? null;
}

function alloc(state: DemoState, prefix: string): [DemoState, string] {
  const seq = state.seq + 1;
  return [{ ...state, seq }, `${prefix}_${seq}`];
}

function replaceUser(state: DemoState, user: User): DemoState {
  return { ...state, users: state.users.map((item) => (item.id === user.id ? user : item)) };
}

function heldSeats(state: DemoState, rideId: string, exceptBookingId?: string): number {
  return state.bookings
    .filter(
      (booking) =>
        booking.rideId === rideId &&
        booking.id !== exceptBookingId &&
        (booking.status === "requested" || booking.status === "accepted"),
    )
    .reduce((sum, booking) => sum + booking.seats, 0);
}

function audit(
  state: DemoState,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  payload: unknown,
  now: Date,
): DemoState {
  const [next, id] = alloc(state, "audit");
  return {
    ...next,
    audits: [
      {
        id,
        actorId,
        action,
        entity,
        entityId,
        payload: JSON.stringify(payload),
        createdAt: now.toISOString(),
      },
      ...next.audits,
    ],
  };
}

function mail(state: DemoState, toUserId: string, subject: string, body: string, now: Date): DemoState {
  const message = mockEmail(toUserId, subject, body);
  const [next, id] = alloc(state, "mail");
  return {
    ...next,
    inbox: [
      {
        id,
        toUserId: message.toUserId,
        subject: message.subject,
        body: message.body,
        createdAt: now.toISOString(),
        read: false,
      },
      ...next.inbox,
    ],
  };
}

function otpCode(phone: string, now: Date): string {
  const digits = `${phone.replace(/\D/g, "")}${now.getTime()}`;
  let hash = 0;
  for (const char of digits) hash = (hash * 33 + char.charCodeAt(0)) % 1_000_000;
  return String(hash).padStart(6, "0");
}

export function reduce(state: DemoState, action: Action, now: Date): ReduceResult {
  switch (action.type) {
    case "set_locale":
      return ok({ ...state, locale: action.locale });
    case "logout":
      return ok({ ...state, sessionUserId: null });
    case "login_as": {
      const user = state.users.find((item) => item.id === action.userId);
      if (!user) return fail(state, "credentials");
      return ok({ ...state, sessionUserId: user.id }, "signed_in");
    }
    case "login": {
      const email = normaliseEmail(action.email);
      const user = state.users.find((item) => item.email === email && item.password === action.password);
      if (!user) return fail(state, "credentials");
      return ok({ ...state, sessionUserId: user.id }, "signed_in");
    }
    case "send_otp": {
      const phone = action.phone.trim();
      if (phone.replace(/\D/g, "").length < 7) return fail(state, "phone");
      const code = otpCode(phone, now);
      const sms = mockSms(phone, code);
      return ok({ ...state, otp: { phone, code: sms.code } }, "otp_sent");
    }
    case "register": {
      const email = normaliseEmail(action.email);
      if (!email) return fail(state, "email");
      if (passwordIssue(action.password)) return fail(state, "password");
      if (action.name.trim().length < 2) return fail(state, "name");
      if (action.role !== "driver" && action.role !== "passenger") return fail(state, "role");
      if (state.users.some((user) => user.email === email)) return fail(state, "exists");
      const phone = action.phone.trim();
      if (!state.otp || state.otp.phone !== phone || state.otp.code !== action.code.trim()) {
        return fail(state, "otp");
      }
      const [next, id] = alloc(state, "user");
      const user: User = {
        id,
        email,
        password: action.password,
        role: action.role,
        name: action.name.trim(),
        phone,
        phoneVerified: true,
        driver: null,
        passenger: null,
      };
      return ok(
        audit(
          { ...next, users: [...next.users, user], sessionUserId: id, otp: null },
          id,
          "registered",
          "user",
          id,
          { role: action.role },
          now,
        ),
        "registered",
      );
    }
    case "submit_passenger": {
      const user = current(state);
      if (!user) return fail(state, "not_signed_in");
      if (user.role !== "passenger") return fail(state, "not_passenger");
      if (action.nic.trim().length < 5) return fail(state, "name");
      const updated: User = {
        ...user,
        passenger: { nic: action.nic.trim(), status: "pending", rejectionReason: "" },
      };
      return ok(
        audit(replaceUser(state, updated), user.id, "verification_submitted", "user", user.id, { role: "passenger" }, now),
        "verified_submitted",
      );
    }
    case "submit_driver": {
      const user = current(state);
      if (!user) return fail(state, "not_signed_in");
      if (user.role !== "driver") return fail(state, "not_driver");
      const fields = [
        action.nic,
        action.licenceNumber,
        action.vehicleReg,
        action.vehicleMake,
        action.vehicleModel,
        action.vehicleColour,
      ];
      if (fields.some((field) => field.trim().length < 2)) return fail(state, "name");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.licenceExpiry) || !/^\d{4}-\d{2}-\d{2}$/.test(action.insuranceExpiry)) {
        return fail(state, "document_expired");
      }
      if (!Number.isInteger(action.seats) || action.seats < 2 || action.seats > 8) return fail(state, "seats");
      const updated: User = {
        ...user,
        driver: {
          nic: action.nic.trim(),
          licenceNumber: action.licenceNumber.trim(),
          licenceExpiry: action.licenceExpiry,
          vehicleReg: action.vehicleReg.trim(),
          vehicleMake: action.vehicleMake.trim(),
          vehicleModel: action.vehicleModel.trim(),
          vehicleColour: action.vehicleColour.trim(),
          seats: action.seats,
          insuranceExpiry: action.insuranceExpiry,
          status: "pending",
          rejectionReason: "",
        },
      };
      return ok(
        audit(replaceUser(state, updated), user.id, "verification_submitted", "user", user.id, { role: "driver" }, now),
        "verified_submitted",
      );
    }
    case "review": {
      const admin = current(state);
      if (!admin || admin.role !== "admin") return fail(state, "not_admin");
      const target = state.users.find((user) => user.id === action.userId);
      if (!target) return fail(state, "booking");
      if (action.decision === "rejected" && action.reason.trim().length < 3) return fail(state, "report");
      const status = action.decision;
      const reason = action.decision === "rejected" ? action.reason.trim() : "";
      const updated: User = {
        ...target,
        driver: target.driver ? { ...target.driver, status, rejectionReason: reason } : null,
        passenger: target.passenger ? { ...target.passenger, status, rejectionReason: reason } : target.passenger,
      };
      if (!updated.driver && !updated.passenger) return fail(state, "booking");
      let next = replaceUser(state, updated);
      next = audit(next, admin.id, "verification_reviewed", "user", target.id, { status, reason }, now);
      next = mail(
        next,
        target.id,
        status === "approved" ? "Verification approved" : "Verification needs another look",
        status === "approved"
          ? "A Bojo Solutions admin approved the details you typed. This is not an NLTA licence."
          : `An admin asked you to resubmit. ${reason}`,
        now,
      );
      return ok(next, "reviewed");
    }
    case "save_settings": {
      const admin = current(state);
      if (!admin || admin.role !== "admin") return fail(state, "not_admin");
      if (!action.acknowledged) return fail(state, "ack_required");
      const cost = parseMurToCents(action.costPerKm);
      const cap = parseMurToCents(action.maxSharePerKm);
      const fee = parseMurToCents(action.platformFee);
      if (cost === "invalid" || cap === "invalid" || fee === "invalid" || cost === null || cap === null || fee === null) {
        return fail(state, "invalid_money");
      }
      const settings: CostConfig = {
        costPerKmCents: cost,
        maxSharePerKmCents: cap,
        platformFeeCents: fee,
        includeDriverInSplit: action.includeDriverInSplit,
        splitBasis: action.splitBasis,
        ratesLabel: "operator",
      };
      const next = audit(
        { ...state, settings },
        admin.id,
        "settings_saved",
        "settings",
        "1",
        { ...settings, acknowledgement: "Operator choice, not a statutory rate." },
        now,
      );
      return ok(next, "settings_saved");
    }
    case "clear_settings": {
      const admin = current(state);
      if (!admin || admin.role !== "admin") return fail(state, "not_admin");
      const next = audit(
        { ...state, settings: UNCONFIGURED },
        admin.id,
        "settings_cleared",
        "settings",
        "1",
        {},
        now,
      );
      return ok(next, "settings_saved");
    }
    case "restore_demo_rates": {
      const admin = current(state);
      if (!admin || admin.role !== "admin") return fail(state, "not_admin");
      const next = audit(
        { ...state, settings: DEMO_RATES },
        admin.id,
        "demo_rates_restored",
        "settings",
        "1",
        { ratesLabel: "demo" },
        now,
      );
      return ok(next, "settings_saved");
    }
    case "post_ride": {
      const user = current(state);
      if (!user) return fail(state, "not_signed_in");
      if (user.role !== "driver" || !user.driver) return fail(state, "not_driver");
      if (user.driver.status !== "approved") return fail(state, "not_verified");
      const today = mauritiusTodayIso(now);
      if (
        !documentStillValid(user.driver.licenceExpiry, today) ||
        !documentStillValid(user.driver.insuranceExpiry, today)
      ) {
        return fail(state, "document_expired");
      }
      if (!settingsReady(state.settings)) return fail(state, "settings_not_configured");
      const departure = parseMauritiusLocal(action.departureLocal);
      if (!departure || departure.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
        return fail(state, "departure");
      }
      if (
        !Number.isInteger(action.seatsOffered) ||
        action.seatsOffered < 1 ||
        action.seatsOffered > user.driver.seats - 1
      ) {
        return fail(state, "seats");
      }
      const distance = estimateTripDistance(action.origin, action.destination, action.manualKm);
      if (!distance.ok) return fail(state, distance.reason);
      if (distance.source === "gazetteer") {
        const check = gazetteerKm(action.origin, action.destination);
        if (check === null || Math.abs(check - distance.km) > 0.11) return fail(state, "invalid_distance");
      }
      const offer = parseMurToCents(action.offerPerSeat);
      if (offer === "invalid") return fail(state, "invalid_money");
      const snapshot: RideSnapshot = {
        formulaVersion: FORMULA_VERSION,
        distanceKm: distance.km,
        seatsOffered: action.seatsOffered,
        driverOfferPerSeatCents: offer,
        config: state.settings,
      };
      try {
        quoteCostShare(snapshot.config, {
          distanceKm: snapshot.distanceKm,
          seatsOffered: snapshot.seatsOffered,
          seatsOnThisBooking: 1,
          confirmedSeatsExcludingThis: 0,
          driverOfferPerSeatCents: snapshot.driverOfferPerSeatCents,
        });
      } catch (error) {
        const code = error instanceof Error && "code" in error ? String(error.code) : "invalid_config";
        if (
          code === "offer_exceeds_cap" ||
          code === "cap_not_configured" ||
          code === "cost_rate_not_configured" ||
          code === "invalid_distance" ||
          code === "invalid_seats" ||
          code === "invalid_config"
        ) {
          return fail(state, code === "invalid_seats" ? "seats" : code);
        }
        return fail(state, "invalid_config");
      }
      const [next, id] = alloc(state, "ride");
      return ok(
        audit(
          {
            ...next,
            rides: [
              {
                id,
                driverId: user.id,
                origin: action.origin.trim(),
                destination: action.destination.trim(),
                departureAt: departure.toISOString(),
                distanceKm: distance.km,
                distanceSource: distance.source,
                seatsOffered: action.seatsOffered,
                status: "open",
                note: action.note.trim().slice(0, 280),
                snapshot,
                createdAt: now.toISOString(),
              },
              ...next.rides,
            ],
          },
          user.id,
          "ride_posted",
          "ride",
          id,
          { distanceKm: distance.km, source: distance.source },
          now,
        ),
        "posted",
      );
    }
    case "cancel_ride": {
      const user = current(state);
      const ride = state.rides.find((item) => item.id === action.rideId);
      if (!user || !ride || ride.driverId !== user.id) return fail(state, "booking");
      if (ride.status !== "open") return fail(state, "ride_closed");
      let next: DemoState = {
        ...state,
        rides: state.rides.map((item) => (item.id === ride.id ? { ...item, status: "cancelled" } : item)),
        bookings: state.bookings.map((booking) =>
          booking.rideId === ride.id && (booking.status === "requested" || booking.status === "accepted")
            ? { ...booking, status: "cancelled" }
            : booking,
        ),
      };
      for (const booking of state.bookings) {
        if (booking.rideId === ride.id && (booking.status === "requested" || booking.status === "accepted")) {
          next = mail(next, booking.passengerId, "Trip cancelled", `${ride.origin} → ${ride.destination} was cancelled.`, now);
        }
      }
      return ok(audit(next, user.id, "ride_cancelled", "ride", ride.id, {}, now), "cancelled");
    }
    case "complete_ride": {
      const user = current(state);
      const ride = state.rides.find((item) => item.id === action.rideId);
      if (!user || !ride || ride.driverId !== user.id) return fail(state, "booking");
      if (ride.status !== "open") return fail(state, "ride_closed");
      if (new Date(ride.departureAt).getTime() > now.getTime()) return fail(state, "departure");
      const next = {
        ...state,
        rides: state.rides.map((item) => (item.id === ride.id ? { ...item, status: "completed" as const } : item)),
      };
      return ok(next, "completed");
    }
    case "request_seat": {
      const user = current(state);
      if (!user) return fail(state, "not_signed_in");
      if (user.role !== "passenger") return fail(state, "not_passenger");
      if (user.passenger?.status !== "approved") return fail(state, "not_verified");
      const ride = state.rides.find((item) => item.id === action.rideId);
      if (!ride || ride.status !== "open") return fail(state, "ride_closed");
      if (ride.driverId === user.id) return fail(state, "own_ride");
      if (new Date(ride.departureAt).getTime() <= now.getTime()) return fail(state, "departed");
      if (!Number.isInteger(action.seats) || action.seats < 1) return fail(state, "seats");
      const existing = state.bookings.find(
        (booking) => booking.rideId === ride.id && booking.passengerId === user.id,
      );
      const held = heldSeats(state, ride.id, existing?.id);
      if (seatsLeft(ride.seatsOffered, held) < action.seats) return fail(state, "no_seats");
      const preview = previewShare(ride.snapshot, state.settings, action.seats, acceptedSeats(state, ride.id));
      if (!preview.ok) return fail(state, preview.error);
      const booking: Booking = {
        id: existing?.id ?? "",
        rideId: ride.id,
        passengerId: user.id,
        seats: action.seats,
        status: "requested",
        quoted: preview.result,
        locked: null,
        passengerMarked: false,
        driverMarked: false,
        disputed: false,
        createdAt: now.toISOString(),
      };
      if (existing && (existing.status === "declined" || existing.status === "cancelled" || existing.status === "requested")) {
        const next = {
          ...state,
          bookings: state.bookings.map((item) => (item.id === existing.id ? { ...booking, id: existing.id } : item)),
        };
        return ok(
          mail(next, ride.driverId, "Seat requested", `${user.name} asked for ${action.seats} seat(s) on ${ride.origin} → ${ride.destination}.`, now),
          "requested",
        );
      }
      if (existing) return fail(state, "booking");
      const [next, id] = alloc(state, "booking");
      return ok(
        mail(
          { ...next, bookings: [{ ...booking, id }, ...next.bookings] },
          ride.driverId,
          "Seat requested",
          `${user.name} asked for ${action.seats} seat(s) on ${ride.origin} → ${ride.destination}.`,
          now,
        ),
        "requested",
      );
    }
    case "accept":
      return decide(state, action.bookingId, "accepted", now);
    case "decline":
      return decide(state, action.bookingId, "declined", now);
    case "cancel_booking": {
      const user = current(state);
      const booking = state.bookings.find((item) => item.id === action.bookingId);
      if (!user || !booking || booking.passengerId !== user.id) return fail(state, "not_party");
      if (booking.status !== "requested" && booking.status !== "accepted") return fail(state, "booking");
      const ride = state.rides.find((item) => item.id === booking.rideId);
      const next = {
        ...state,
        bookings: state.bookings.map((item) =>
          item.id === booking.id ? { ...item, status: "cancelled" as const } : item,
        ),
      };
      return ok(
        ride
          ? mail(next, ride.driverId, "Seat released", `${user.name} released a seat on ${ride.origin} → ${ride.destination}.`, now)
          : next,
        "cancelled",
      );
    }
    case "mark_handover": {
      const user = current(state);
      const booking = state.bookings.find((item) => item.id === action.bookingId);
      const ride = booking ? state.rides.find((item) => item.id === booking.rideId) : undefined;
      if (!user || !booking || !ride || booking.status !== "accepted") return fail(state, "booking");
      const isPassenger = user.id === booking.passengerId && action.side === "passenger";
      const isDriver = user.id === ride.driverId && action.side === "driver";
      if (!isPassenger && !isDriver) return fail(state, "not_party");
      const record = recordOfflineShare();
      if (record.moneyMoved) return fail(state, "invalid_config");
      const updated: Booking = {
        ...booking,
        passengerMarked: booking.passengerMarked || action.side === "passenger",
        driverMarked: booking.driverMarked || action.side === "driver",
      };
      const next = audit(
        {
          ...state,
          bookings: state.bookings.map((item) => (item.id === booking.id ? updated : item)),
        },
        user.id,
        "offline_share_marked",
        "booking",
        booking.id,
        record,
        now,
      );
      return ok(next, "marked");
    }
    case "dispute": {
      const user = current(state);
      const booking = state.bookings.find((item) => item.id === action.bookingId);
      const ride = booking ? state.rides.find((item) => item.id === booking.rideId) : undefined;
      if (!user || !booking || !ride) return fail(state, "booking");
      if (user.id !== booking.passengerId && user.id !== ride.driverId) return fail(state, "not_party");
      const next = {
        ...state,
        bookings: state.bookings.map((item) => (item.id === booking.id ? { ...item, disputed: true } : item)),
      };
      return ok(audit(next, user.id, "disputed", "booking", booking.id, {}, now), "disputed");
    }
    case "report": {
      const user = current(state);
      if (!user) return fail(state, "not_signed_in");
      const ride = state.rides.find((item) => item.id === action.rideId);
      if (!ride) return fail(state, "booking");
      if (action.reason.trim().length < 5) return fail(state, "report");
      const [next, id] = alloc(state, "report");
      return ok(
        {
          ...next,
          reports: [
            { id, rideId: ride.id, reporterId: user.id, reason: action.reason.trim(), createdAt: now.toISOString() },
            ...next.reports,
          ],
        },
        "reported",
      );
    }
    case "read_inbox":
      return ok({
        ...state,
        inbox: state.inbox.map((item) => (item.id === action.id ? { ...item, read: true } : item)),
      });
    case "reset_demo":
      return ok(seed(now), "reset");
    default:
      return fail(state, "booking");
  }
}

function acceptedSeats(state: DemoState, rideId: string): number {
  return state.bookings
    .filter((booking) => booking.rideId === rideId && booking.status === "accepted")
    .reduce((sum, booking) => sum + booking.seats, 0);
}

function decide(state: DemoState, bookingId: string, status: "accepted" | "declined", now: Date): ReduceResult {
  const user = current(state);
  const booking = state.bookings.find((item) => item.id === bookingId);
  const ride = booking ? state.rides.find((item) => item.id === booking.rideId) : undefined;
  if (!user || !booking || !ride || ride.driverId !== user.id) return fail(state, "booking");
  if (booking.status !== "requested" || ride.status !== "open") return fail(state, "booking");
  if (status === "declined") {
    const next = {
      ...state,
      bookings: state.bookings.map((item) => (item.id === booking.id ? { ...item, status: "declined" as const } : item)),
    };
    return ok(
      mail(next, booking.passengerId, "Request declined", `${ride.origin} → ${ride.destination} was declined.`, now),
      "declined",
    );
  }
  const held = heldSeats(state, ride.id, booking.id);
  if (seatsLeft(ride.seatsOffered, held) < booking.seats) return fail(state, "no_seats");
  const preview = previewShare(ride.snapshot, state.settings, booking.seats, acceptedSeats(state, ride.id));
  if (!preview.ok) return fail(state, preview.error);
  const locked = preview.result;
  let next: DemoState = {
    ...state,
    bookings: state.bookings.map((item) =>
      item.id === booking.id ? { ...item, status: "accepted", locked, quoted: locked } : item,
    ),
  };
  const share = (locked.payablePerSeatCents / 100).toFixed(2);
  next = mail(
    next,
    booking.passengerId,
    "Seat confirmed",
    `Your cost share is Rs ${share} per seat on ${ride.origin} → ${ride.destination}. No money moved in the app.`,
    now,
  );
  next = mail(
    next,
    ride.driverId,
    "Passenger confirmed",
    `A seat is confirmed. You receive the capped cost share only, recorded as Rs ${share} per seat.`,
    now,
  );
  return ok(audit(next, user.id, "booking_accepted", "booking", booking.id, { payablePerSeatCents: locked.payablePerSeatCents }, now), "accepted");
}
