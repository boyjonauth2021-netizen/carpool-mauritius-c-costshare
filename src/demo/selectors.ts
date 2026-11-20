import { previewShare, settingsReady } from "@/domain/cost-share";
import { seatsLeft } from "@/domain/policy";
import type { DemoState, Ride, User } from "./types";

export function currentUser(state: DemoState): User | null {
  return state.users.find((user) => user.id === state.sessionUserId) ?? null;
}

export function heldSeats(state: DemoState, rideId: string): number {
  return state.bookings
    .filter(
      (booking) =>
        booking.rideId === rideId && (booking.status === "requested" || booking.status === "accepted"),
    )
    .reduce((sum, booking) => sum + booking.seats, 0);
}

export function seatsRemaining(state: DemoState, ride: Ride): number {
  return seatsLeft(ride.seatsOffered, heldSeats(state, ride.id));
}

export function quoteRide(state: DemoState, ride: Ride, seats = 1) {
  if (!settingsReady(state.settings)) {
    return { ok: false as const, error: "settings_not_configured" as const };
  }
  const accepted = state.bookings
    .filter((booking) => booking.rideId === ride.id && booking.status === "accepted")
    .reduce((sum, booking) => sum + booking.seats, 0);
  return previewShare(ride.snapshot, state.settings, seats, accepted);
}

export function unreadCount(state: DemoState, userId: string | null): number {
  if (!userId) return 0;
  return state.inbox.filter((item) => item.toUserId === userId && !item.read).length;
}
