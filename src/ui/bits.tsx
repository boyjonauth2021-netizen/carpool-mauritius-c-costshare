"use client";

import type { ComponentProps, ReactNode } from "react";
import { mapsBrowserKey } from "@/adapters/mocks";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CostShareResult } from "@/domain/cost-share";
import { formatMur } from "@/domain/money";
import { lookupPlace } from "@/domain/places";
import type { Dict } from "./copy";

export function Flash({
  flash,
  dict,
}: {
  flash: { kind: "ok" | "err"; code: string } | null;
  dict: Dict;
}) {
  if (!flash) return null;
  const text =
    flash.kind === "err"
      ? dict.errors[flash.code as keyof Dict["errors"]] ?? flash.code
      : dict.notices[flash.code as keyof Dict["notices"]] ?? flash.code;
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        flash.kind === "err" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
      )}
    >
      {text}
    </p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function LinkButton({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  return (
    <a href={href} className={cn(buttonVariants({ variant, size: "lg" }), "h-11 px-4")}>
      {children}
    </a>
  );
}

export function StatusBadge({ status, dict }: { status: string; dict: Dict }) {
  const label =
    status === "approved"
      ? dict.verify.approved
      : status === "pending"
        ? dict.verify.pending
        : status === "rejected"
          ? dict.verify.rejected
          : status === "none"
            ? dict.verify.none
            : status;
  const variant = status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export function RoutePanel({
  origin,
  destination,
  km,
  sourceLabel,
}: {
  origin: string;
  destination: string;
  km: number;
  sourceLabel: string;
}) {
  const key = mapsBrowserKey();
  const from = lookupPlace(origin);
  const to = lookupPlace(destination);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_180px] sm:items-center">
        <div className="grid grid-cols-[16px_1fr] gap-3">
          <div className="flex flex-col items-center py-1">
            <span className="size-3 rounded-full bg-primary" />
            <span className="my-1 w-px flex-1 bg-primary/35" />
            <span className="size-3 rounded-full border-2 border-primary bg-card" />
          </div>
          <div className="grid gap-4">
            <p className="font-display text-lg leading-tight">{origin}</p>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {km.toFixed(1)} km · {sourceLabel}
            </p>
            <p className="font-display text-lg leading-tight">{destination}</p>
          </div>
        </div>
        <div className="relative h-28 overflow-hidden rounded-xl bg-[#d7ebe4]">
          <svg viewBox="0 0 180 110" className="h-full w-full" aria-hidden>
            <path d="M16 78 C 50 70, 70 30, 110 36 S 150 20, 166 28" fill="none" stroke="#0f5e59" strokeWidth="3" />
            <circle cx="16" cy="78" r="5" fill="#0f5e59" />
            <circle cx="166" cy="28" r="5" fill="#f4efe6" stroke="#0f5e59" strokeWidth="2" />
          </svg>
          {key && from && to ? (
            <p className="absolute inset-x-2 bottom-2 rounded-md bg-white/85 px-2 py-1 text-[10px] text-foreground">
              Maps key present. Distance still comes from the demo gazetteer.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CostBreakdown({
  result,
  dict,
  locale,
}: {
  result: CostShareResult;
  dict: Dict;
  locale: "en" | "fr";
}) {
  const money = (cents: number) => formatMur(cents, locale);
  const rows: [string, string][] = [
    [dict.rides.running, money(result.directCostCents)],
    [dict.rides.split, `${result.passengerSeatsInSplit} + ${result.occupants - result.passengerSeatsInSplit}`],
    [dict.rides.uncapped, money(result.uncappedSharePerSeatCents)],
    [dict.rides.cap, money(result.capPerSeatCents)],
    [dict.rides.payable, money(result.payablePerSeatCents)],
    [dict.rides.passengerPays, money(result.passengerPaysCents)],
    [dict.rides.driverGets, money(result.driverReceivesCents)],
    [dict.rides.retained, money(result.driverRetainedCostCents)],
  ];
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {result.ratesLabel === "demo" ? dict.rides.demoRate : result.ratesLabel === "operator" ? dict.rides.operatorRate : result.ratesLabel}
        </Badge>
        {result.capped ? <Badge>{dict.rides.cap}</Badge> : null}
        {result.tightened ? <Badge variant="outline">{dict.rides.capTight}</Badge> : null}
      </div>
      <dl className="grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-dashed pb-2 last:border-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm">{dict.rides.notFare}</p>
      {result.platformFeeNeedsLegalReview ? (
        <p className="text-sm text-destructive">{dict.rides.feeFlag}</p>
      ) : null}
      {result.tightened ? <p className="text-sm text-muted-foreground">{dict.rides.capTight}</p> : null}
    </div>
  );
}

export function PrimaryButton(props: ComponentProps<typeof Button>) {
  return <Button type="submit" size="lg" className="h-11 px-4" {...props} />;
}
