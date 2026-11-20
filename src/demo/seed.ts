import { FORMULA_VERSION, type CostConfig, type RideSnapshot } from "@/domain/cost-share";
import { gazetteerKm } from "@/domain/places";
import { addMauritiusDays } from "@/domain/time";
import type { DemoState, Ride, User } from "./types";

/** Demo rates only. Not a statutory Mauritius figure. */
export const DEMO_RATES: CostConfig = {
  costPerKmCents: 1500,
  maxSharePerKmCents: 800,
  platformFeeCents: 0,
  includeDriverInSplit: true,
  splitBasis: "offered_seats",
  ratesLabel: "demo",
};

export const DEMO_PASSWORD = "demo-pass";

const YEAR = "2027-12-31";

function driverUser(): User {
  return {
    id: "user_driver",
    email: "driver@bojo.demo",
    password: DEMO_PASSWORD,
    role: "driver",
    name: "Kevin Lajoie",
    phone: "+230 5123 4400",
    phoneVerified: true,
    passenger: null,
    driver: {
      nic: "L0000000000000",
      licenceNumber: "DL-DEMO-100",
      licenceExpiry: YEAR,
      vehicleReg: "DEMO 1234",
      vehicleMake: "Toyota",
      vehicleModel: "Vitz",
      vehicleColour: "Silver",
      seats: 4,
      insuranceExpiry: YEAR,
      status: "approved",
      rejectionReason: "",
    },
  };
}

function ride(
  id: string,
  origin: string,
  destination: string,
  when: Date,
  seatsOffered: number,
  now: Date,
): Ride {
  const distanceKm = gazetteerKm(origin, destination);
  if (distanceKm === null) throw new Error(`Seed place missing: ${origin} → ${destination}`);
  const snapshot: RideSnapshot = {
    formulaVersion: FORMULA_VERSION,
    distanceKm,
    seatsOffered,
    driverOfferPerSeatCents: null,
    config: DEMO_RATES,
  };
  return {
    id,
    driverId: "user_driver",
    origin,
    destination,
    departureAt: when.toISOString(),
    distanceKm,
    distanceSource: "gazetteer",
    seatsOffered,
    status: "open",
    note: "",
    snapshot,
    createdAt: now.toISOString(),
  };
}

export function seed(now: Date): DemoState {
  const curepipe = ride(
    "ride_curepipe",
    "Curepipe",
    "Port Louis",
    addMauritiusDays(now, 1, 7, 15),
    3,
    now,
  );
  const quatreBornes = ride(
    "ride_qb",
    "Quatre Bornes",
    "Ebene",
    addMauritiusDays(now, 1, 8, 0),
    2,
    now,
  );
  const baie = ride(
    "ride_baie",
    "Grand Baie",
    "Port Louis",
    addMauritiusDays(now, 1, 7, 40),
    3,
    now,
  );

  return {
    seq: 100,
    locale: "en",
    sessionUserId: null,
    settings: DEMO_RATES,
    otp: null,
    reports: [],
    inbox: [
      {
        id: "mail_welcome",
        toUserId: "user_passenger",
        subject: "Demo inbox",
        body: "Emails stay in this browser. Nothing was sent to a mail server.",
        createdAt: now.toISOString(),
        read: false,
      },
    ],
    audits: [
      {
        id: "audit_seed",
        actorId: null,
        action: "demo_seeded",
        entity: "settings",
        entityId: "1",
        payload: JSON.stringify({
          ratesLabel: "demo",
          note: "Demo rates are not a statutory cap.",
        }),
        createdAt: now.toISOString(),
      },
    ],
    users: [
      {
        id: "user_admin",
        email: "admin@bojo.demo",
        password: DEMO_PASSWORD,
        role: "admin",
        name: "Bojo Desk",
        phone: "+230 5000 0001",
        phoneVerified: true,
        driver: null,
        passenger: null,
      },
      driverUser(),
      {
        id: "user_passenger",
        email: "passenger@bojo.demo",
        password: DEMO_PASSWORD,
        role: "passenger",
        name: "Meera Boolaky",
        phone: "+230 5760 2200",
        phoneVerified: true,
        driver: null,
        passenger: { nic: "B0000000000000", status: "approved", rejectionReason: "" },
      },
      {
        id: "user_pending",
        email: "asha@bojo.demo",
        password: DEMO_PASSWORD,
        role: "driver",
        name: "Asha Ramphul",
        phone: "+230 5911 7788",
        phoneVerified: true,
        passenger: null,
        driver: {
          nic: "R0000000000000",
          licenceNumber: "DL-DEMO-240",
          licenceExpiry: YEAR,
          vehicleReg: "DEMO 7781",
          vehicleMake: "Suzuki",
          vehicleModel: "Swift",
          vehicleColour: "Blue",
          seats: 4,
          insuranceExpiry: YEAR,
          status: "pending",
          rejectionReason: "",
        },
      },
    ],
    rides: [curepipe, quatreBornes, baie],
    bookings: [],
  };
}
