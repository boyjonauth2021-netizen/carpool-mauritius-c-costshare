# Carpool Mauritius — version C plan

Version C only: regulated, capped cost sharing for Bojo Solutions. This repository has no free-matching mode (A) and no paid-ride mode (B).

## Static demo (how this repo actually runs)

The live demo is a fully static site for GitHub Pages:

https://boyjonauth2021-netizen.github.io/carpool-mauritius-c-costshare/

- Next.js `output: "export"`, base path `/carpool-mauritius-c-costshare/`.
- Hash routes (`#/rides`, `#/admin/settings`) so a refresh does not need a server. `out/404.html` is a copy of `index.html` as a fallback.
- Build folder: `out/`.
- No server, no database process, no secrets. The logical records below are stored in `localStorage` under `carpool-mauritius-c:v1`.
- Maps, SMS, email, and payment are mock adapters in `src/adapters/mocks.ts`. Distance comes from a Mauritius gazetteer. A Google browser key is optional and unused in the Pages build.
- The cost-share formula in `src/domain/cost-share.ts` is unchanged: configurable rates, null means “not set”, demo rates are labelled demo.

Workflow: `.github/workflows/pages.yml` tests, builds, and deploys `out/` on push to `main`. In the GitHub repo, Pages must be set to GitHub Actions.

## Spec file

The task named `Project_C_Regulated_Cost_Sharing.txt` (upload path `/workspace/uploads/Project_C_Regulated_Cost_Sharing_9322.txt`). That file was not on disk in this environment. It was also not in Kevin's Google Drive, Gmail, or the Bojo GitHub and Origin repositories this run could read.

This plan follows the working instructions that were included in the task:

- Plan, schema, keys, and unresolved decisions live in this file.
- Build in small phases. Business rules, especially the cost cap, live in `src/domain` and are unit-tested.
- Secrets stay out of git. Names only, in `.env.example`.
- Where a cap or a rule was not fixed, it is configuration. The app does not invent a statutory number.
- MVP: English and French, driver and passenger roles, admin verification, ride posting and matching, capped cost share, Google Maps behind a key placeholder.
- Deployable on its own. Steps are in the README.

Anything the missing spec may have already decided is listed under open decisions and is not treated as settled.

## Product shape

People share a trip the driver was already going to make. A passenger pays a contribution toward the running cost of that trip. The contribution is capped. The driver does not set a fare, and the app does not call the contribution a fare.

Money does not move inside the app. The MVP records the agreed contribution and lets both people mark an offline handover. No card acquirer, no Juice, no wallet.

## Phases

1. This plan, `.env.example`, and the Next.js app shell.
2. Domain layer and unit tests: money parsing, cost-share formula, live-cap tightening, matching, ride gates, Mauritius local time, Distance Matrix parsing.
3. SQLite schema, sessions, registration, verification, admin review.
4. Ride posting, search, request, accept, and the cost-share breakdown.
5. English and French copy, Maps placeholder, demo seed, Docker, README.

## Stack

- Next.js static export, TypeScript, Tailwind, shadcn/ui, hash routing.
- The schema below is the logical model. The demo persists it as JSON in `localStorage`. There is no database server in this build.
- Vitest for the domain and the demo reducer.
- Demo sign-in compares the password stored in that JSON. The passwords are the published demo password, not production credentials. A server build would hash them.
- Cache Components are off. `output: "export"` does not use a request.

## Roles

| Role | How the account is created | What they can do |
| --- | --- | --- |
| Passenger | Self-register | Submit a NIC for review. After approval, search trips and request a seat. |
| Driver | Self-register | Submit licence, vehicle, and insurance dates for review. After approval, post a trip. |
| Admin | `npm run bootstrap:admin` from env | Approve or reject verification, set the cost settings, read the audit log and reports. |

One account has one role. An admin cannot self-register.

## Verification

The app stores what the person typed and, optionally, nothing more. It does not call NLTA, the Traffic Branch, or an identity vendor. Approval means a Bojo Solutions admin looked at the submission. It does not mean the state has licensed the trip.

A driver whose typed licence expiry or insurance expiry is before today's date in Mauritius cannot post. That is a date check on the typed value, not a check that the document is genuine.

National identity numbers are shown to admins only. Phone numbers are shown to the other party only after a request is accepted.

## Cost-share formula (`c-cost-share-v1`)

All money inside the domain is integer cents of the Mauritian rupee. Inputs are rejected when a rate has not been configured. Null is not treated as zero.

Configured inputs:

- `costPerKmCents` — operator estimate of running cost per kilometre. Not a statutory rate.
- `maxSharePerKmCents` — hard ceiling on what one passenger seat may contribute per kilometre. Not a statutory cap.
- `platformFeeCents` — defaults to 0. Any positive fee is flagged `platformFeeNeedsLegalReview` and is not paid to the driver.
- `includeDriverInSplit` — default true. The driver's own place counts in the split.
- `splitBasis` — default `offered_seats`. The alternative `confirmed_passengers` is implemented and tested, and it can change the quote as people join or cancel.

For a quote:

1. Running cost = round(distance km × cost per km).
2. Passenger seats in the split = seats offered, or confirmed seats plus this booking, depending on `splitBasis`.
3. Occupants = those seats, plus one when the driver is included.
4. Uncapped share = floor(running cost / occupants).
5. Cap for the seat = round(distance km × max share per km).
6. No-profit ceiling = floor(running cost / passenger seats in the split).
7. Formula share = the minimum of those three.
8. If the driver typed a lower amount per seat, the payable share is that amount. A higher amount is rejected.
9. The driver receives payable × seats on this booking. A platform fee, if any, is added only to what the passenger pays and is retained by the platform.

Invariants the tests lock:

- The driver cannot receive more than the running cost if every seat in the split pays the same share.
- The payable share cannot exceed the per-seat cap.
- A missing cost rate or a missing cap refuses the quote. The UI blocks posting and requesting.
- Tightening: a later, lower cap or lower fee replaces the published quote. A later higher quote does not raise what the passenger already saw. If the settings are cleared, new requests are blocked. Already accepted amounts stay as recorded.

Demo seed writes rates with label `demo`. The banner says they are not a legal cap. A fresh database leaves both rates null.

## Matching

Text is folded (case and accents) and scored with token overlap. Threshold default is 0.5 (`MATCH_TEXT_THRESHOLD`).

If both the query and the trip have coordinates, a match is also possible within `MATCH_RADIUS_KM` (default 8). The MVP search box does not geocode the query, so search is text plus departure window until a Maps key exists. The radius path is tested.

A trip matches only when it is open, has a seat left, and departs inside the window. The default window is the chosen Mauritius calendar day, or the next 14 days when no date is chosen (`SEARCH_HORIZON_DAYS`).

## Distance

The driver types the kilometres. If `GOOGLE_MAPS_API_KEY` is set, the server calls the Distance Matrix API and blocks publishing when the typed distance differs from Google by more than `DISTANCE_VARIANCE_RATIO` (default 0.15), unless the driver accepts the Google figure.

If the key is missing, the trip is stored as `distanceSource: manual` and the page says the distance was not checked. That is a deliberate MVP gap, not a claim that the typed distance is right.

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is the browser key for the map on a trip page. With it unset, the page shows a route panel and does not load Maps.

Sanity bound: distances above 150 km are rejected. Mauritius is smaller than that. This is not a legal rule.

## Database schema

Logical model. The static demo stores these records in one JSON document, not in SQLite. Money fields are integer cents. Statuses are strings. Sign-in is `sessionUserId` on that document, not a cookie.

### User

`id`, `email` unique, `passwordHash`, `role` (`passenger` | `driver` | `admin`), `name`, `phone` nullable, `locale` (`en` | `fr`), `createdAt`.

### Session

`id` (random token, the cookie value), `userId`, `expiresAt`.

### DriverProfile

`userId` primary key, `nic`, `licenceNumber`, `licenceExpiry` (`YYYY-MM-DD`), `vehicleReg`, `vehicleMake`, `vehicleModel`, `vehicleColour`, `seats`, `insuranceExpiry`, `status` (`pending` | `approved` | `rejected`), `rejectionReason`, `reviewedAt`, `reviewedById`.

### PassengerProfile

`userId` primary key, `nic`, `status`, `rejectionReason`, `reviewedAt`, `reviewedById`.

### CostSettings

Singleton `id = 1`. `costPerKmCents` nullable, `maxSharePerKmCents` nullable, `platformFeeCents`, `includeDriverInSplit`, `splitBasis`, `ratesLabel` (`unconfigured` | `demo` | `operator`), `updatedAt`, `updatedById`.

### Ride

`id`, `driverId`, origin and destination labels, optional lat/lng, `departureAt`, `distanceKm`, `distanceSource` (`manual` | `google`), `seatsOffered`, `status` (`open` | `cancelled` | `completed`), `note`, `driverOfferPerSeatCents` nullable, `snapshotJson` (the config used at publish), `createdAt`.

### Booking

`id`, `rideId`, `passengerId`, unique pair, `seats`, `status` (`requested` | `accepted` | `declined` | `cancelled`), `snapshotJson`, `payablePerSeatCents`, `platformFeePerSeatCents`, `passengerPaysCents`, `driverReceivesCents`, `passengerMarked`, `driverMarked`, `disputed`, `createdAt`.

Accepted amounts are the locked record. They are not recomputed after accept.

### AuditLog

`id`, `actorId` nullable, `action`, `entity`, `entityId`, `payload` JSON string, `createdAt`.

### Report

`id`, `rideId`, `reporterId`, `reason`, `createdAt`.

## External keys and services

| Name | Required for MVP to boot | What it is for |
| --- | --- | --- |
| `DATABASE_URL` | Yes, with the local SQLite default | Database file |
| `SESSION_SECRET` | Yes, before anyone can sign in | Refuses placeholder values |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Yes, to create the first admin | Used only by the bootstrap script |
| `GOOGLE_MAPS_API_KEY` | No | Server Distance Matrix. IP-restrict the key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Browser map. HTTP-referrer-restrict the key |
| `SEED_DEMO`, `SEED_DEMO_PASSWORD` | No | Local fictional accounts and demo rates |

Not integrated, and no credentials are invented for them:

- Email or SMS (no verification mail, no trip reminders).
- Payment (MCB Juice, Blink, card acquiring, bank transfer).
- Identity or licence lookup (NLTA, Mauritius Police Traffic Branch, Maupass).
- Google geocoding of the search box. Distance Matrix is the only Maps call on the server.

Maps APIs to enable if Kevin creates a Google Cloud project: Maps JavaScript API, Places API (the form still works without Places autocomplete), Distance Matrix API. Billing must be on the Google account. This app does not create that project.

## Deploy

See the README. Node 22, `npm ci`, `npm test`, `npm run build`. The static site is the `out/` folder. GitHub Actions uploads that folder to Pages. There is no server process to run.

## Open legal questions

These are questions for counsel. The app does not answer them.

1. Does a private car, carrying passengers who reimburse a capped share of cost, need a public service vehicle licence, taxi licence, or contract-car licence under the Road Traffic Act and the National Land Transport Authority Act 2019? The NLTA publishes contract-car policy. This app does not assume an exemption.
2. Is there a statutory or ministerial cap, per kilometre or otherwise, for this kind of arrangement? None is configured here. A number in the demo seed is labelled demo and is not a proposal for that cap.
3. May the driver be made whole for fuel only, or also for a share of insurance, tyres, and depreciation? The single "running cost per km" setting does not split those components.
4. May Bojo Solutions charge a platform fee without being treated as a transport operator or as selling a fare? The fee defaults to 0. A non-zero fee is flagged and is not described as cleared.
5. Who is liable in a crash: the driver's motor insurance, the passenger, or Bojo Solutions? The form records an insurance expiry date. It does not check that the policy covers paying passengers.
6. Does admin approval of a NIC, licence number, and insurance date meet whatever duty of care applies, or is a formal KYC vendor required?
7. Is Bojo Solutions registered with the Data Protection Office as a controller under the Data Protection Act 2017? The privacy page names the Act and the kind of data collected. It does not claim a registration, a DPO appointment, or a completed assessment.
8. How long may NIC numbers, licence numbers, and trip history be kept, and when must they be deleted?
9. Are passengers' pickup points precise enough to be sensitive location data, and is the stated basis for processing them adequate?
10. Does marking an offline cash handover create a record Bojo must keep for tax, and is the contribution subject to VAT?
11. Rodrigues: the NLTA Act gives the Rodrigues Transport Committee its own licensing functions. The MVP does not treat Rodrigues as a separate regime.
12. French and English are the product languages. Kreol Morisien is not included. Whether consumer-facing terms must also be in Kreol is open.
13. What cancellation rule is allowed? The MVP has no cancellation fee, because a fee can look like a fare. Whether a no-show should have a consequence is open.

## Open product decisions

Configured in code or in Cost Settings, and flagged in the admin screen:

- The numeric cost rate, the cap, and whether a platform fee exists.
- Whether the driver's seat counts in the split (default yes).
- Whether the split uses seats offered (default, stable quote) or seats already confirmed (quote can move).
- Match text threshold (0.5), match radius (8 km), distance variance (15%), minimum lead time (30 minutes), search horizon (14 days), maximum typed distance (150 km).
- One role per account, rather than a person who both drives and rides.
- Browse is open to signed-out visitors. Requesting a seat needs a verified passenger. Phone numbers stay hidden until acceptance.
- No in-app payment, no chat, no ratings, no document file upload, no email.
- An accepted contribution is not revised after acceptance, except that the acceptance itself applies a lower live cap if settings were tightened between request and accept.
- Demo rates exist only after `npm run seed:demo`.

## What the MVP deliberately does not do

- It does not claim that carpooling is legal in Mauritius.
- It does not invent an NLTA permission, an insurance endorsement, or a statutory rupee figure.
- It does not take a commission unless an admin sets a fee and ticks the acknowledgement. The acknowledgement is a reminder, not a legal opinion.
- It does not contain a switch for version A or version B.
