"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseHash, type Route } from "@/demo/hash";
import { loadOrSeed, saveState } from "@/demo/persist";
import { reduce } from "@/demo/reduce";
import { currentUser, unreadCount } from "@/demo/selectors";
import type { Action, DemoState, ReduceResult } from "@/demo/types";
import { Flash } from "./bits";
import { en, fr, type Dict } from "./copy";
import {
  AccountScreen,
  AdminScreen,
  AuditScreen,
  AuthScreen,
  HomeScreen,
  InboxScreen,
  NewRideScreen,
  ProseScreen,
  RideScreen,
  RidesScreen,
  SettingsScreen,
  TripsScreen,
  VerifyScreen,
} from "./screens";

export function App() {
  const [state, setState] = useState<DemoState | null>(null);
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; code: string } | null>(null);
  const stateRef = useRef<DemoState | null>(null);

  useEffect(() => {
    const loaded = loadOrSeed(new Date(), window.localStorage);
    stateRef.current = loaded;
    setState(loaded);
    setRoute(parseHash(window.location.hash));
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (state) document.documentElement.lang = state.locale === "fr" ? "fr" : "en";
  }, [state]);

  function dispatch(action: Action): ReduceResult {
    const current = stateRef.current;
    if (!current) {
      const empty = loadOrSeed(new Date(), window.localStorage);
      stateRef.current = empty;
      setState(empty);
      return { state: empty, error: "not_signed_in" };
    }
    const result = reduce(current, action, new Date());
    stateRef.current = result.state;
    saveState(result.state, window.localStorage);
    setState(result.state);
    if (result.error) setFlash({ kind: "err", code: result.error });
    else if (result.notice) setFlash({ kind: "ok", code: result.notice });
    else setFlash(null);
    return result;
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="grid gap-2 text-center">
          <p className="font-display text-4xl">Carpool Mauritius</p>
          <p className="text-muted-foreground">{en.splash}</p>
        </div>
      </main>
    );
  }

  const dict: Dict = state.locale === "fr" ? fr : en;
  const user = currentUser(state);
  const unread = unreadCount(state, user?.id ?? null);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <a href="#/" className="mr-auto grid leading-tight">
            <span className="font-display text-xl">{dict.brand}</span>
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{dict.company}</span>
          </a>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Nav href="#/rides" label={dict.nav.rides} />
            {user?.role === "driver" ? <Nav href="#/rides/new" label={dict.nav.post} /> : null}
            {user ? <Nav href="#/trips" label={dict.nav.mine} /> : null}
            {user && user.role !== "admin" ? <Nav href="#/verify" label={dict.nav.verify} /> : null}
            {user ? <Nav href="#/inbox" label={`${dict.nav.inbox}${unread ? ` (${unread})` : ""}`} /> : null}
            {user?.role === "admin" ? <Nav href="#/admin" label={dict.nav.admin} /> : null}
          </nav>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant={state.locale === "en" ? "default" : "ghost"} onClick={() => dispatch({ type: "set_locale", locale: "en" })}>
              EN
            </Button>
            <Button type="button" size="sm" variant={state.locale === "fr" ? "default" : "ghost"} onClick={() => dispatch({ type: "set_locale", locale: "fr" })}>
              FR
            </Button>
          </div>
          {user ? (
            <Button type="button" variant="outline" size="sm" onClick={() => dispatch({ type: "logout" })}>
              {dict.nav.signOut}
            </Button>
          ) : (
            <a href="#/login" className="text-sm underline">
              {dict.nav.signIn}
            </a>
          )}
        </div>
        <p className="border-t bg-[#e7f3ef] px-4 py-2 text-center text-xs text-foreground/80">{dict.demoBanner}</p>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-8">
        <Flash flash={flash} dict={dict} />
        <Screen route={route} state={state} dispatch={dispatch} dict={dict} />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-6 text-sm text-muted-foreground">
          <span>{dict.version}</span>
          <a className="underline" href="#/legal">{dict.nav.legal}</a>
          <a className="underline" href="#/privacy">{dict.nav.privacy}</a>
          <a className="underline" href="#/account">{dict.nav.account}</a>
        </div>
      </footer>
    </div>
  );
}

function Nav({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="rounded-full px-3 py-1.5 hover:bg-secondary">
      {label}
    </a>
  );
}

function Screen({
  route,
  ...props
}: {
  route: Route;
  state: DemoState;
  dispatch: (action: Action) => ReduceResult;
  dict: Dict;
}) {
  switch (route.name) {
    case "home":
      return <HomeScreen {...props} />;
    case "login":
      return <AuthScreen {...props} mode="login" />;
    case "register":
      return <AuthScreen {...props} mode="register" />;
    case "rides":
      return <RidesScreen {...props} />;
    case "new-ride":
      return <NewRideScreen {...props} />;
    case "ride":
      return <RideScreen {...props} id={route.id} />;
    case "trips":
      return <TripsScreen {...props} />;
    case "verify":
      return <VerifyScreen {...props} />;
    case "inbox":
      return <InboxScreen {...props} />;
    case "account":
      return <AccountScreen {...props} />;
    case "admin":
      return <AdminScreen {...props} />;
    case "settings":
      return <SettingsScreen {...props} />;
    case "audit":
      return <AuditScreen {...props} />;
    case "legal":
      return <ProseScreen title={props.dict.legal.title} body={props.dict.legal.body} />;
    case "privacy":
      return <ProseScreen title={props.dict.privacy.title} body={props.dict.privacy.body} />;
    default:
      return <HomeScreen {...props} />;
  }
}
