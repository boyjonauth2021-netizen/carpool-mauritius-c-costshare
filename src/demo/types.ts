import type { CostConfig, CostShareResult, RideSnapshot } from "@/domain/cost-share";

export type Role = "passenger" | "driver" | "admin";
export type ReviewStatus = "none" | "pending" | "approved" | "rejected";

export type DriverProfile = {
  nic: string;
  licenceNumber: string;
  licenceExpiry: string;
  vehicleReg: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColour: string;
  seats: number;
  insuranceExpiry: string;
  status: ReviewStatus;
  rejectionReason: string;
};

export type PassengerProfile = {
  nic: string;
  status: ReviewStatus;
  rejectionReason: string;
};

export type User = {
  id: string;
  email: string;
  password: string;
  role: Role;
  name: string;
  phone: string;
  phoneVerified: boolean;
  driver: DriverProfile | null;
  passenger: PassengerProfile | null;
};

export type Ride = {
  id: string;
  driverId: string;
  origin: string;
  destination: string;
  departureAt: string;
  distanceKm: number;
  distanceSource: "gazetteer" | "manual";
  seatsOffered: number;
  status: "open" | "cancelled" | "completed";
  note: string;
  snapshot: RideSnapshot;
  createdAt: string;
};

export type Booking = {
  id: string;
  rideId: string;
  passengerId: string;
  seats: number;
  status: "requested" | "accepted" | "declined" | "cancelled";
  quoted: CostShareResult;
  locked: CostShareResult | null;
  passengerMarked: boolean;
  driverMarked: boolean;
  disputed: boolean;
  createdAt: string;
};

export type InboxItem = {
  id: string;
  toUserId: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  payload: string;
  createdAt: string;
};

export type Report = {
  id: string;
  rideId: string;
  reporterId: string;
  reason: string;
  createdAt: string;
};

export type DemoState = {
  seq: number;
  locale: "en" | "fr";
  sessionUserId: string | null;
  users: User[];
  rides: Ride[];
  bookings: Booking[];
  settings: CostConfig;
  inbox: InboxItem[];
  audits: AuditEntry[];
  reports: Report[];
  otp: { phone: string; code: string } | null;
};

export type Action =
  | { type: "login"; email: string; password: string }
  | { type: "login_as"; userId: string }
  | { type: "logout" }
  | { type: "set_locale"; locale: "en" | "fr" }
  | { type: "send_otp"; phone: string }
  | {
      type: "register";
      name: string;
      email: string;
      password: string;
      phone: string;
      role: "passenger" | "driver";
      code: string;
    }
  | { type: "submit_passenger"; nic: string }
  | {
      type: "submit_driver";
      nic: string;
      licenceNumber: string;
      licenceExpiry: string;
      vehicleReg: string;
      vehicleMake: string;
      vehicleModel: string;
      vehicleColour: string;
      seats: number;
      insuranceExpiry: string;
    }
  | { type: "review"; userId: string; decision: "approved" | "rejected"; reason: string }
  | {
      type: "save_settings";
      costPerKm: string;
      maxSharePerKm: string;
      platformFee: string;
      includeDriverInSplit: boolean;
      splitBasis: "offered_seats" | "confirmed_passengers";
      acknowledged: boolean;
    }
  | { type: "clear_settings" }
  | { type: "restore_demo_rates" }
  | {
      type: "post_ride";
      origin: string;
      destination: string;
      departureLocal: string;
      seatsOffered: number;
      note: string;
      offerPerSeat: string;
      manualKm: string;
    }
  | { type: "cancel_ride"; rideId: string }
  | { type: "complete_ride"; rideId: string }
  | { type: "request_seat"; rideId: string; seats: number }
  | { type: "accept"; bookingId: string }
  | { type: "decline"; bookingId: string }
  | { type: "cancel_booking"; bookingId: string }
  | { type: "mark_handover"; bookingId: string; side: "passenger" | "driver" }
  | { type: "dispute"; bookingId: string }
  | { type: "report"; rideId: string; reason: string }
  | { type: "read_inbox"; id: string }
  | { type: "reset_demo" };

export type ErrorCode =
  | "email"
  | "password"
  | "credentials"
  | "exists"
  | "name"
  | "phone"
  | "role"
  | "otp"
  | "not_signed_in"
  | "not_driver"
  | "not_passenger"
  | "not_admin"
  | "not_verified"
  | "document_expired"
  | "settings_not_configured"
  | "settings_withdrawn"
  | "ack_required"
  | "invalid_money"
  | "invalid_distance"
  | "invalid_seats"
  | "unknown_place"
  | "departure"
  | "seats"
  | "offer_exceeds_cap"
  | "ride_closed"
  | "own_ride"
  | "no_seats"
  | "departed"
  | "booking"
  | "not_party"
  | "report"
  | "cost_rate_not_configured"
  | "cap_not_configured"
  | "invalid_config";

export type NoticeCode =
  | "otp_sent"
  | "registered"
  | "signed_in"
  | "verified_submitted"
  | "reviewed"
  | "settings_saved"
  | "posted"
  | "requested"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed"
  | "marked"
  | "disputed"
  | "reported"
  | "reset";

export type ReduceResult = {
  state: DemoState;
  error?: ErrorCode;
  notice?: NoticeCode;
};
