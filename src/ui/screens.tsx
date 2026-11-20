"use client";

import { useState } from "react";
import { FORMULA_VERSION, previewShare, settingsReady } from "@/domain/cost-share";
import { formatMur, publicName } from "@/domain/money";
import { matchScore, rideMatches, type RideCandidate } from "@/domain/matching";
import { PLACES, lookupPlace } from "@/domain/places";
import { SEARCH_HORIZON_DAYS } from "@/domain/policy";
import { formatMauritius, mauritiusDayRange, mauritiusTodayIso } from "@/domain/time";
import { go } from "@/demo/hash";
import { currentUser, quoteRide, seatsRemaining } from "@/demo/selectors";
import type { Action, DemoState, ReduceResult, Ride } from "@/demo/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CostBreakdown, Field, LinkButton, PrimaryButton, RoutePanel, StatusBadge } from "./bits";
import type { Dict } from "./copy";

export type ScreenProps = {
  state: DemoState;
  dispatch: (action: Action) => ReduceResult;
  dict: Dict;
};

const inputClass = "h-10 bg-card";

function money(cents: number, locale: "en" | "fr") {
  return formatMur(cents, locale);
}

function defaultDeparture() {
  const [year, month, day] = mauritiusTodayIso(new Date()).split("-").map(Number);
  const next = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + 1));
  return `${next.toISOString().slice(0, 10)}T08:00`;
}

function person(state: DemoState, id: string) {
  return state.users.find((user) => user.id === id);
}

export function HomeScreen({ state, dict }: ScreenProps) {
  const example = settingsReady(state.settings)
    ? previewShare(
        {
          formulaVersion: FORMULA_VERSION,
          distanceKm: 20,
          seatsOffered: 3,
          driverOfferPerSeatCents: null,
          config: state.settings,
        },
        state.settings,
        1,
        0,
      )
    : null;
  const open = state.rides.filter((ride) => ride.status === "open" && seatsRemaining(state, ride) > 0).slice(0, 3);
  return (
    <div className="grid gap-10">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div className="grid gap-4">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">{dict.home.kicker}</p>
          <h1 className="font-display text-4xl leading-[1.05] text-balance sm:text-6xl">{dict.home.title}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{dict.home.lede}</p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="#/rides">{dict.home.browse}</LinkButton>
            <LinkButton href="#/rides/new" variant="outline">
              {dict.home.offer}
            </LinkButton>
          </div>
        </div>
        <Card className="bg-[#e7f3ef]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{dict.home.exampleTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {example && example.ok ? (
              <>
                <p>
                  {money(example.result.directCostCents, state.locale)} · {money(example.result.payablePerSeatCents, state.locale)}{" "}
                  / {dict.rides.seats.replace("left", "").trim() || "seat"}
                </p>
                <p className="text-muted-foreground">{dict.home.exampleNote}</p>
                <p>{dict.rides.notFare}</p>
              </>
            ) : (
              <p>{dict.home.blocked}</p>
            )}
          </CardContent>
        </Card>
      </section>
      <ol className="grid gap-3 sm:grid-cols-3">
        {[dict.home.step1, dict.home.step2, dict.home.step3].map((step, index) => (
          <li key={step} className="rounded-2xl border bg-card p-4">
            <span className="font-display text-3xl text-primary">{index + 1}</span>
            <p className="mt-2 text-sm">{step}</p>
          </li>
        ))}
      </ol>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{dict.home.open}</h2>
        <div className="grid gap-3">
          {open.map((ride) => (
            <RideCard key={ride.id} state={state} ride={ride} dict={dict} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function RideCard({ state, ride, dict }: { state: DemoState; ride: Ride; dict: Dict }) {
  const quote = quoteRide(state, ride, 1);
  const driver = person(state, ride.driverId);
  return (
    <a href={`#/rides/${ride.id}`} className="grid gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-sm text-muted-foreground">{formatMauritius(new Date(ride.departureAt), state.locale)}</p>
        <p className="font-display text-xl">
          {ride.origin} → {ride.destination}
        </p>
        <p className="text-sm text-muted-foreground">
          {publicName(driver?.name ?? "")} · {seatsRemaining(state, ride)} {dict.rides.seats}
        </p>
      </div>
      <p className="font-display text-2xl tabular-nums">
        {quote.ok ? money(quote.result.payablePerSeatCents, state.locale) : "—"}
      </p>
    </a>
  );
}

export function AuthScreen({ state, dispatch, dict, mode }: ScreenProps & { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo-pass");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+230 ");
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [code, setCode] = useState("");
  const [shown, setShown] = useState("");

  function enter(userId: string, hash: string) {
    dispatch({ type: "login_as", userId });
    go(hash);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl">{mode === "login" ? dict.auth.signIn : dict.auth.register}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mode === "login") {
                const result = dispatch({ type: "login", email, password });
                if (!result.error) go("#/rides");
              } else {
                const result = dispatch({ type: "register", name, email, password, phone, role, code });
                if (!result.error) go("#/verify");
              }
            }}
          >
            {mode === "register" ? (
              <>
                <Field label={dict.auth.name}>
                  <Input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
                </Field>
                <Field label={dict.auth.role}>
                  <select className={`${inputClass} w-full rounded-lg border px-3`} value={role} onChange={(event) => setRole(event.target.value as "passenger" | "driver")}>
                    <option value="passenger">{dict.auth.passenger}</option>
                    <option value="driver">{dict.auth.driver}</option>
                  </select>
                </Field>
                <Field label={dict.auth.phone}>
                  <Input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} required />
                </Field>
                <div className="flex flex-wrap items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      const result = dispatch({ type: "send_otp", phone });
                      if (!result.error && result.state.otp) setShown(result.state.otp.code);
                    }}
                  >
                    {dict.auth.sendCode}
                  </Button>
                  {shown ? (
                    <p className="text-sm">
                      {dict.auth.otpIs}: <strong>{shown}</strong>. {dict.auth.codeHelp}
                    </p>
                  ) : null}
                </div>
                <Field label={dict.auth.code}>
                  <Input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" />
                </Field>
              </>
            ) : null}
            <Field label={dict.auth.email}>
              <Input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label={dict.auth.password}>
              <Input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <PrimaryButton>{mode === "login" ? dict.auth.submit : dict.auth.create}</PrimaryButton>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? dict.auth.need : dict.auth.have}{" "}
              <a className="underline" href={mode === "login" ? "#/register" : "#/login"}>
                {mode === "login" ? dict.nav.register : dict.nav.signIn}
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3 content-start">
        <h2 className="font-display text-2xl">{dict.demo.title}</h2>
        <p className="text-sm text-muted-foreground">{dict.demo.password}</p>
        <Button type="button" variant="secondary" className="h-11 justify-start" onClick={() => enter("user_passenger", "#/rides")}>
          {dict.demo.passenger}
        </Button>
        <Button type="button" variant="secondary" className="h-11 justify-start" onClick={() => enter("user_driver", "#/trips")}>
          {dict.demo.driver}
        </Button>
        <Button type="button" variant="secondary" className="h-11 justify-start" onClick={() => enter("user_admin", "#/admin")}>
          {dict.demo.admin}
        </Button>
        <Button type="button" variant="outline" className="h-11 justify-start" onClick={() => enter("user_pending", "#/verify")}>
          {dict.demo.pending}
        </Button>
      </div>
    </div>
  );
}

export function VerifyScreen({ state, dispatch, dict }: ScreenProps) {
  const user = currentUser(state);
  const [nic, setNic] = useState(user?.passenger?.nic ?? user?.driver?.nic ?? "");
  const [licenceNumber, setLicenceNumber] = useState(user?.driver?.licenceNumber ?? "");
  const [licenceExpiry, setLicenceExpiry] = useState(user?.driver?.licenceExpiry ?? "2027-12-31");
  const [vehicleReg, setVehicleReg] = useState(user?.driver?.vehicleReg ?? "");
  const [vehicleMake, setVehicleMake] = useState(user?.driver?.vehicleMake ?? "");
  const [vehicleModel, setVehicleModel] = useState(user?.driver?.vehicleModel ?? "");
  const [vehicleColour, setVehicleColour] = useState(user?.driver?.vehicleColour ?? "");
  const [seats, setSeats] = useState(String(user?.driver?.seats ?? 4));
  const [insuranceExpiry, setInsuranceExpiry] = useState(user?.driver?.insuranceExpiry ?? "2027-12-31");
  if (!user) {
    return <LinkButton href="#/login">{dict.nav.signIn}</LinkButton>;
  }
  const status = user.role === "driver" ? (user.driver?.status ?? "none") : (user.passenger?.status ?? "none");
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-4xl">{dict.verify.title}</h1>
      <p className="text-muted-foreground">{user.role === "passenger" ? dict.verify.passengerLede : dict.verify.lede}</p>
      <StatusBadge status={status} dict={dict} />
      {user.driver?.rejectionReason || user.passenger?.rejectionReason ? (
        <Alert variant="destructive">
          <AlertTitle>{dict.verify.rejected}</AlertTitle>
          <AlertDescription>{user.driver?.rejectionReason || user.passenger?.rejectionReason}</AlertDescription>
        </Alert>
      ) : null}
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (user.role === "passenger") dispatch({ type: "submit_passenger", nic });
          else {
            dispatch({
              type: "submit_driver",
              nic,
              licenceNumber,
              licenceExpiry,
              vehicleReg,
              vehicleMake,
              vehicleModel,
              vehicleColour,
              seats: Number(seats),
              insuranceExpiry,
            });
          }
        }}
      >
        <Field label={dict.verify.nic}>
          <Input className={inputClass} value={nic} onChange={(event) => setNic(event.target.value)} required />
        </Field>
        {user.role === "driver" ? (
          <>
            <Field label={dict.verify.licence}>
              <Input className={inputClass} value={licenceNumber} onChange={(event) => setLicenceNumber(event.target.value)} required />
            </Field>
            <Field label={dict.verify.licenceExpiry}>
              <Input className={inputClass} type="date" value={licenceExpiry} onChange={(event) => setLicenceExpiry(event.target.value)} required />
            </Field>
            <Field label={dict.verify.reg}>
              <Input className={inputClass} value={vehicleReg} onChange={(event) => setVehicleReg(event.target.value)} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={dict.verify.make}>
                <Input className={inputClass} value={vehicleMake} onChange={(event) => setVehicleMake(event.target.value)} required />
              </Field>
              <Field label={dict.verify.model}>
                <Input className={inputClass} value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} required />
              </Field>
              <Field label={dict.verify.colour}>
                <Input className={inputClass} value={vehicleColour} onChange={(event) => setVehicleColour(event.target.value)} required />
              </Field>
            </div>
            <Field label={dict.verify.seats}>
              <Input className={inputClass} type="number" min={2} max={8} value={seats} onChange={(event) => setSeats(event.target.value)} required />
            </Field>
            <Field label={dict.verify.insurance}>
              <Input className={inputClass} type="date" value={insuranceExpiry} onChange={(event) => setInsuranceExpiry(event.target.value)} required />
            </Field>
          </>
        ) : null}
        <PrimaryButton>{dict.verify.submit}</PrimaryButton>
      </form>
    </div>
  );
}

export function RidesScreen({ state, dict }: ScreenProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const range = date ? mauritiusDayRange(date) : null;
  const earliest = range?.earliest ?? new Date();
  const latest = range?.latest ?? new Date(Date.now() + SEARCH_HORIZON_DAYS * 86_400_000);
  const ranked = state.rides
    .map((ride) => {
      const candidate: RideCandidate = {
        originLabel: ride.origin,
        destinationLabel: ride.destination,
        originPoint: lookupPlace(ride.origin)?.point,
        destinationPoint: lookupPlace(ride.destination)?.point,
        departureAt: new Date(ride.departureAt),
        seatsLeft: seatsRemaining(state, ride),
        status: ride.status,
      };
      return { ride, candidate };
    })
    .filter(({ candidate }) => rideMatches({ from, to, earliest, latest }, candidate))
    .sort((a, b) => matchScore({ from, to, earliest, latest }, b.candidate) - matchScore({ from, to, earliest, latest }, a.candidate));

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-4xl">{dict.rides.title}</h1>
      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
        <Field label={dict.rides.from}>
          <Input className={inputClass} list="places" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label={dict.rides.to}>
          <Input className={inputClass} list="places" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label={dict.rides.date}>
          <Input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" className="h-10 w-full">{dict.rides.search}</Button>
        </div>
        <PlaceList />
      </form>
      {ranked.length === 0 ? <p className="text-muted-foreground">{dict.rides.empty}</p> : null}
      <div className="grid gap-3">
        {ranked.map(({ ride }) => (
          <RideCard key={ride.id} state={state} ride={ride} dict={dict} />
        ))}
      </div>
    </div>
  );
}

function PlaceList() {
  return (
    <datalist id="places">
      {PLACES.map((place) => (
        <option key={place.name} value={place.name} />
      ))}
    </datalist>
  );
}

export function NewRideScreen({ state, dispatch, dict }: ScreenProps) {
  const user = currentUser(state);
  const [origin, setOrigin] = useState("Curepipe");
  const [destination, setDestination] = useState("Port Louis");
  const [when, setWhen] = useState(defaultDeparture);
  const [seats, setSeats] = useState("2");
  const [offer, setOffer] = useState("");
  const [manualKm, setManualKm] = useState("");
  const [note, setNote] = useState("");
  if (!user) return <LinkButton href="#/login">{dict.nav.signIn}</LinkButton>;
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-4xl">{dict.rides.postTitle}</h1>
      <p className="text-muted-foreground">{dict.rides.postLede}</p>
      {!settingsReady(state.settings) ? <Alert><AlertDescription>{dict.home.blocked}</AlertDescription></Alert> : null}
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const result = dispatch({
            type: "post_ride",
            origin,
            destination,
            departureLocal: when,
            seatsOffered: Number(seats),
            note,
            offerPerSeat: offer,
            manualKm,
          });
          if (!result.error) {
            const created = result.state.rides.find((ride) => ride.driverId === user.id && ride.origin === origin.trim());
            go(created ? `#/rides/${created.id}` : "#/trips");
          }
        }}
      >
        <Field label={dict.rides.from}>
          <Input className={inputClass} list="places" value={origin} onChange={(event) => setOrigin(event.target.value)} required />
        </Field>
        <Field label={dict.rides.to}>
          <Input className={inputClass} list="places" value={destination} onChange={(event) => setDestination(event.target.value)} required />
        </Field>
        <PlaceList />
        <Field label={dict.rides.when}>
          <Input className={inputClass} type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} required />
        </Field>
        <Field label={dict.rides.seatsOffered}>
          <Input className={inputClass} type="number" min={1} max={6} value={seats} onChange={(event) => setSeats(event.target.value)} required />
        </Field>
        <Field label={dict.rides.km}>
          <Input className={inputClass} value={manualKm} onChange={(event) => setManualKm(event.target.value)} placeholder="18.5" />
        </Field>
        <Field label={dict.rides.offer}>
          <Input className={inputClass} value={offer} onChange={(event) => setOffer(event.target.value)} />
        </Field>
        <p className="text-xs text-muted-foreground">{dict.rides.offerHint}</p>
        <Field label={dict.rides.note}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <PrimaryButton>{dict.rides.publish}</PrimaryButton>
      </form>
    </div>
  );
}

export function RideScreen({ state, dispatch, dict, id }: ScreenProps & { id: string }) {
  const ride = state.rides.find((item) => item.id === id);
  const user = currentUser(state);
  const [seats, setSeats] = useState("1");
  const [reason, setReason] = useState("");
  if (!ride) return <p>{dict.rides.empty}</p>;
  const driver = person(state, ride.driverId);
  const quote = quoteRide(state, ride, Number(seats) || 1);
  const mine = state.bookings.filter((booking) => booking.rideId === ride.id);
  const source = ride.distanceSource === "gazetteer" ? dict.rides.gazetteer : dict.rides.manual;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4">
        <a className="text-sm underline" href="#/rides">{dict.common.back}</a>
        <h1 className="font-display text-4xl">
          {ride.origin} → {ride.destination}
        </h1>
        <p className="text-muted-foreground">
          {formatMauritius(new Date(ride.departureAt), state.locale)} · {publicName(driver?.name ?? "")} · {ride.status}
        </p>
        <RoutePanel origin={ride.origin} destination={ride.destination} km={ride.distanceKm} sourceLabel={source} />
        {ride.note ? <p>{ride.note}</p> : null}
        {quote.ok ? <CostBreakdown result={quote.result} dict={dict} locale={state.locale} /> : <Alert><AlertDescription>{dict.errors[quote.error as keyof Dict["errors"]] ?? quote.error}</AlertDescription></Alert>}
      </div>
      <div className="grid content-start gap-4">
        {user?.role === "passenger" && ride.status === "open" ? (
          <form
            className="grid gap-3 rounded-2xl border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              dispatch({ type: "request_seat", rideId: ride.id, seats: Number(seats) });
            }}
          >
            <Field label={dict.rides.howMany}>
              <Input className={inputClass} type="number" min={1} value={seats} onChange={(event) => setSeats(event.target.value)} />
            </Field>
            <PrimaryButton>{dict.rides.request}</PrimaryButton>
            <p className="text-xs text-muted-foreground">{dict.rides.phoneHidden}</p>
          </form>
        ) : null}
        {user?.id === ride.driverId ? (
          <div className="grid gap-2">
            <h2 className="font-display text-2xl">{dict.rides.requests}</h2>
            {mine.length === 0 ? <p className="text-sm text-muted-foreground">{dict.rides.noRequests}</p> : null}
            {mine.map((booking) => {
              const passenger = person(state, booking.passengerId);
              return (
                <div key={booking.id} className="grid gap-2 rounded-xl border p-3 text-sm">
                  <p>
                    {passenger?.name} · {booking.seats} · {booking.status}
                  </p>
                  <p className="tabular-nums">{money((booking.locked ?? booking.quoted).payablePerSeatCents, state.locale)}</p>
                  {booking.status === "requested" ? (
                    <div className="flex gap-2">
                      <Button type="button" className="h-10" onClick={() => dispatch({ type: "accept", bookingId: booking.id })}>
                        {dict.rides.accept}
                      </Button>
                      <Button type="button" variant="outline" className="h-10" onClick={() => dispatch({ type: "decline", bookingId: booking.id })}>
                        {dict.rides.decline}
                      </Button>
                    </div>
                  ) : null}
                  {booking.status === "accepted" && passenger ? (
                    <p>
                      {dict.rides.phone}: {passenger.phone}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {ride.status === "open" ? (
              <Button type="button" variant="outline" onClick={() => dispatch({ type: "cancel_ride", rideId: ride.id })}>
                {dict.rides.cancelRide}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => dispatch({ type: "complete_ride", rideId: ride.id })}>
              {dict.rides.complete}
            </Button>
          </div>
        ) : null}
        {mine
          .filter((booking) => user && booking.passengerId === user.id)
          .map((booking) => (
            <div key={booking.id} className="grid gap-2 rounded-2xl border p-4 text-sm">
              <p>
                {dict.common.status}: {booking.status}
              </p>
              {booking.status === "accepted" && driver ? (
                <p>
                  {dict.rides.phone}: {driver.phone}
                </p>
              ) : null}
              {booking.status === "accepted" ? (
                <>
                  <p className="text-muted-foreground">{dict.rides.settlementNote}</p>
                  <Button type="button" onClick={() => dispatch({ type: "mark_handover", bookingId: booking.id, side: "passenger" })}>
                    {dict.rides.handed}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => dispatch({ type: "dispute", bookingId: booking.id })}>
                    {dict.rides.dispute}
                  </Button>
                </>
              ) : null}
              {booking.status === "requested" || booking.status === "accepted" ? (
                <Button type="button" variant="ghost" onClick={() => dispatch({ type: "cancel_booking", bookingId: booking.id })}>
                  {dict.rides.cancelSeat}
                </Button>
              ) : null}
            </div>
          ))}
        {user?.id === ride.driverId
          ? mine
              .filter((booking) => booking.status === "accepted")
              .map((booking) => (
                <Button key={`${booking.id}-got`} type="button" variant="secondary" onClick={() => dispatch({ type: "mark_handover", bookingId: booking.id, side: "driver" })}>
                  {dict.rides.received}
                </Button>
              ))
          : null}
        {user ? (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              dispatch({ type: "report", rideId: ride.id, reason });
              setReason("");
            }}
          >
            <Field label={dict.rides.report}>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <Button type="submit" variant="outline">{dict.rides.reportSend}</Button>
          </form>
        ) : (
          <LinkButton href="#/login" variant="outline">{dict.nav.signIn}</LinkButton>
        )}
      </div>
    </div>
  );
}

export function TripsScreen({ state, dict }: ScreenProps) {
  const user = currentUser(state);
  if (!user) return <LinkButton href="#/login">{dict.nav.signIn}</LinkButton>;
  const rides = state.rides.filter((ride) => ride.driverId === user.id);
  const bookings = state.bookings.filter((booking) => booking.passengerId === user.id);
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-4xl">{dict.rides.mineTitle}</h1>
      {rides.length === 0 && bookings.length === 0 ? <p className="text-muted-foreground">{dict.rides.noMine}</p> : null}
      {rides.map((ride) => (
        <RideCard key={ride.id} state={state} ride={ride} dict={dict} />
      ))}
      {bookings.map((booking) => {
        const ride = state.rides.find((item) => item.id === booking.rideId);
        if (!ride) return null;
        return (
          <a key={booking.id} href={`#/rides/${ride.id}`} className="rounded-2xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{booking.status}</p>
            <p className="font-display text-xl">
              {ride.origin} → {ride.destination}
            </p>
          </a>
        );
      })}
    </div>
  );
}

export function AdminScreen({ state, dispatch, dict }: ScreenProps) {
  const user = currentUser(state);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (!user || user.role !== "admin") return <p>{dict.errors.not_admin}</p>;
  const waiting = state.users.filter(
    (account) => account.driver?.status === "pending" || account.passenger?.status === "pending",
  );
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-display text-4xl">{dict.admin.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{dict.admin.lede}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="#/admin/settings" variant="outline">{dict.nav.settings}</LinkButton>
        <LinkButton href="#/admin/audit" variant="outline">{dict.nav.audit}</LinkButton>
      </div>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{dict.admin.queue}</h2>
        {waiting.length === 0 ? <p className="text-muted-foreground">{dict.admin.emptyQueue}</p> : null}
        {waiting.map((account) => (
          <Card key={account.id}>
            <CardContent className="grid gap-3 pt-4">
              <p className="font-medium">{account.name}</p>
              <p className="text-sm text-muted-foreground">{account.email} · {account.role}</p>
              {account.driver ? (
                <p className="text-sm">
                  {account.driver.vehicleMake} {account.driver.vehicleModel} · {account.driver.vehicleReg} · NIC {account.driver.nic} · {account.driver.licenceNumber}
                </p>
              ) : null}
              {account.passenger ? <p className="text-sm">NIC {account.passenger.nic}</p> : null}
              <Field label={dict.admin.reason}>
                <Input className={inputClass} value={reasons[account.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [account.id]: event.target.value })} />
              </Field>
              <div className="flex gap-2">
                <Button type="button" onClick={() => dispatch({ type: "review", userId: account.id, decision: "approved", reason: "" })}>
                  {dict.admin.approve}
                </Button>
                <Button type="button" variant="outline" onClick={() => dispatch({ type: "review", userId: account.id, decision: "rejected", reason: reasons[account.id] ?? "" })}>
                  {dict.admin.reject}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{dict.admin.people}</h2>
        {state.users.map((account) => (
          <p key={account.id} className="text-sm">
            {account.name} · {account.role} · {account.driver?.status ?? account.passenger?.status ?? "—"}
          </p>
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{dict.admin.reports}</h2>
        {state.reports.length === 0 ? <p className="text-sm text-muted-foreground">{dict.admin.noReports}</p> : null}
        {state.reports.map((report) => (
          <p key={report.id} className="text-sm">
            {report.reason}
          </p>
        ))}
      </section>
    </div>
  );
}

export function SettingsScreen({ state, dispatch, dict }: ScreenProps) {
  const user = currentUser(state);
  const [cost, setCost] = useState(state.settings.costPerKmCents === null ? "" : (state.settings.costPerKmCents / 100).toFixed(2));
  const [cap, setCap] = useState(state.settings.maxSharePerKmCents === null ? "" : (state.settings.maxSharePerKmCents / 100).toFixed(2));
  const [fee, setFee] = useState((state.settings.platformFeeCents / 100).toFixed(2));
  const [include, setInclude] = useState(state.settings.includeDriverInSplit);
  const [basis, setBasis] = useState(state.settings.splitBasis);
  const [ack, setAck] = useState(false);
  if (!user || user.role !== "admin") return <p>{dict.errors.not_admin}</p>;
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-4xl">{dict.admin.settingsTitle}</h1>
      <p className="text-muted-foreground">{dict.admin.settingsLede}</p>
      <p className="text-sm">
        {dict.common.status}: {state.settings.ratesLabel}
      </p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({
            type: "save_settings",
            costPerKm: cost,
            maxSharePerKm: cap,
            platformFee: fee,
            includeDriverInSplit: include,
            splitBasis: basis,
            acknowledged: ack,
          });
        }}
      >
        <Field label={dict.admin.cost}>
          <Input className={inputClass} value={cost} onChange={(event) => setCost(event.target.value)} />
        </Field>
        <Field label={dict.admin.cap}>
          <Input className={inputClass} value={cap} onChange={(event) => setCap(event.target.value)} />
        </Field>
        <Field label={dict.admin.fee}>
          <Input className={inputClass} value={fee} onChange={(event) => setFee(event.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={include} onChange={(event) => setInclude(event.target.checked)} />
          {dict.admin.include}
        </label>
        <Field label={dict.admin.basis}>
          <select className={`${inputClass} w-full rounded-lg border px-3`} value={basis} onChange={(event) => setBasis(event.target.value as typeof basis)}>
            <option value="offered_seats">{dict.admin.offered}</option>
            <option value="confirmed_passengers">{dict.admin.confirmed}</option>
          </select>
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
          <span>{dict.admin.ack}</span>
        </label>
        <PrimaryButton>{dict.admin.save}</PrimaryButton>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => dispatch({ type: "clear_settings" })}>
          {dict.admin.clear}
        </Button>
        <Button type="button" variant="secondary" onClick={() => dispatch({ type: "restore_demo_rates" })}>
          {dict.admin.restore}
        </Button>
      </div>
    </div>
  );
}

export function AuditScreen({ state, dict }: ScreenProps) {
  const user = currentUser(state);
  if (!user || user.role !== "admin") return <p>{dict.errors.not_admin}</p>;
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-4xl">{dict.admin.auditTitle}</h1>
      {state.audits.length === 0 ? <p>{dict.admin.auditEmpty}</p> : null}
      {state.audits.map((entry) => (
        <article key={entry.id} className="rounded-xl border bg-card p-3 text-sm">
          <p className="font-medium">{entry.action}</p>
          <p className="text-muted-foreground">{formatMauritius(new Date(entry.createdAt), state.locale)}</p>
          <p className="mt-1 break-all text-xs">{entry.payload}</p>
        </article>
      ))}
    </div>
  );
}

export function InboxScreen({ state, dispatch, dict }: ScreenProps) {
  const user = currentUser(state);
  if (!user) return <LinkButton href="#/login">{dict.nav.signIn}</LinkButton>;
  const items = state.inbox.filter((item) => item.toUserId === user.id);
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-4xl">{dict.inbox.title}</h1>
      <p className="text-sm text-muted-foreground">{dict.inbox.mock}</p>
      {items.length === 0 ? <p>{dict.inbox.empty}</p> : null}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="rounded-xl border bg-card p-4 text-left"
          onClick={() => dispatch({ type: "read_inbox", id: item.id })}
        >
          <p className="font-medium">{item.subject}</p>
          <p className="text-sm text-muted-foreground">{item.body}</p>
          {!item.read ? <span className="text-xs text-primary">●</span> : null}
        </button>
      ))}
    </div>
  );
}

export function AccountScreen({ state, dispatch, dict }: ScreenProps) {
  const user = currentUser(state);
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-4xl">{dict.account.title}</h1>
      {user ? (
        <p>
          {user.name} · {user.email} · {user.role}
        </p>
      ) : (
        <p>{dict.account.signedOut}</p>
      )}
      <p className="text-sm text-muted-foreground">{dict.account.resetHelp}</p>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          dispatch({ type: "reset_demo" });
          go("#/");
        }}
      >
        {dict.account.reset}
      </Button>
    </div>
  );
}

export function ProseScreen({ title, body }: { title: string; body: readonly string[] }) {
  return (
    <article className="grid max-w-2xl gap-4">
      <h1 className="font-display text-4xl">{title}</h1>
      {body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </article>
  );
}
