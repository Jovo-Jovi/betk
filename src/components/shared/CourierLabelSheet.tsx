"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * CourierLabelSheet — admin pickup label on P76 from the recipient snapshot
 * and the store pickup address. Net-new (CD-DELTA-6 Wave 3, §2.9). One sheet.
 * M2 guard (§8c, defense-in-depth): only `audience === "admin"` renders. Any
 * other runtime value, including omission, renders nothing. The type has no
 * other member and no seller-route prop. The Phase 14 CI import ban and the
 * data layer are the boundary.
 * Empty: any required snapshot or pickup string is blank (nullable in the DB,
 * W3-1) → `emptyLabel`, no label. Error → `errorLabel`, no label. Loading →
 * skeleton, no partial address. A blank is never printed as an address.
 * References: `displayRef` renders only when non-null; otherwise
 * `legacyBetkRef` when non-null. Strings render as given; no format (REG-81).
 * Focus moves to the sheet when it mounts and returns to the previously
 * focused control (the opener) when it unmounts.
 * Emits `onPrintRequest` only. Token-only. All strings are props (DS-I18N).
 */
export interface CourierLabelSheetProps {
  /** Literal guard. Only "admin" renders. */
  audience: "admin";
  /** master_orders.recipient_name */
  recipientName: string;
  /** master_orders.recipient_phone */
  recipientPhone: string;
  /** master_orders.snapshot_governorate */
  snapshotGovernorate: string;
  /** master_orders.snapshot_city */
  snapshotCity: string;
  /** master_orders.snapshot_street_address */
  snapshotStreetAddress: string;
  /** master_orders.snapshot_building_notes */
  snapshotBuildingNotes?: string | null;
  /** store_pickup_addresses.governorate */
  pickupGovernorate: string;
  /** store_pickup_addresses.city */
  pickupCity: string;
  /** store_pickup_addresses.street_address */
  pickupStreetAddress: string;
  /** store_pickup_addresses.building_notes */
  pickupBuildingNotes?: string | null;
  /** seller_orders.display_ref — render only when non-null. */
  displayRef: string | null;
  /** seller_orders.betk_ref — historical order number. */
  legacyBetkRef?: string | null;
  /** State: snapshot not ready. */
  loading?: boolean;
  /** State: a required snapshot field failed. */
  error?: boolean;
  /** courierLabel.recipient */
  recipientLabel: string;
  /** courierLabel.phone */
  phoneLabel: string;
  /** courierLabel.address */
  addressLabel: string;
  /** courierLabel.pickup */
  pickupLabel: string;
  /** courierLabel.ref */
  refLabel: string;
  /** courierLabel.print */
  printLabel: string;
  /** courierLabel.empty */
  emptyLabel: string;
  /** courierLabel.error */
  errorLabel: string;
  /** courierLabel.loading (additive key proposal) */
  loadingLabel: string;
  onPrintRequest?: () => void;
  className?: string;
}

const filled = (s: string | null | undefined) => typeof s === "string" && s.trim().length > 0;

function Address({ governorate, city, street, notes }: { governorate: string; city: string; street: string; notes?: string | null }) {
  return (
    <address className="flex flex-col gap-0.5 not-italic text-sm leading-relaxed text-foreground">
      <span>{street}</span>
      {filled(notes) && <span className="text-muted-foreground">{notes}</span>}
      <span>{city}</span>
      <span>{governorate}</span>
    </address>
  );
}

export function CourierLabelSheet(props: CourierLabelSheetProps) {
  const {
    audience, recipientName, recipientPhone, snapshotGovernorate, snapshotCity, snapshotStreetAddress, snapshotBuildingNotes,
    pickupGovernorate, pickupCity, pickupStreetAddress, pickupBuildingNotes, displayRef, legacyBetkRef,
    loading = false, error = false, recipientLabel, phoneLabel, addressLabel, pickupLabel, refLabel, printLabel,
    emptyLabel, errorLabel, loadingLabel, onPrintRequest, className,
  } = props;
  const sheetRef = React.useRef<HTMLElement>(null);
  const headingId = React.useId();
  const isAdmin = (audience as unknown) === "admin";
  const complete = [recipientName, recipientPhone, snapshotGovernorate, snapshotCity, snapshotStreetAddress, pickupGovernorate, pickupCity, pickupStreetAddress].every(filled);
  const ready = isAdmin && !loading && !error && complete;
  const ref = displayRef !== null && filled(displayRef) ? displayRef : filled(legacyBetkRef) ? (legacyBetkRef as string) : null;

  React.useEffect(() => {
    if (!ready) return;
    const opener = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });
    return () => { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, [ready]);

  if (!isAdmin) return null;

  const live = loading ? loadingLabel : !error && !complete ? emptyLabel : "";
  const frame = "rounded-lg border border-border bg-card p-4 text-card-foreground";

  return (
    <div aria-busy={loading || undefined} className={cn("flex flex-col", className)}>
      <span role="status" aria-live="polite" className="sr-only">{live}</span>
      {loading ? (
        <div aria-hidden className={cn(frame, "flex flex-col gap-3")}>
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div role="alert" className={cn(frame, "flex items-center gap-2")}>
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-destructive">{errorLabel}</p>
        </div>
      ) : !complete ? (
        <div className={cn(frame, "border-dashed")}>
          <p aria-hidden className="text-center text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <section
          ref={sheetRef}
          tabIndex={-1}
          aria-labelledby={headingId}
          className={cn("flex flex-col gap-4 rounded-lg border-2 border-foreground bg-background p-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background")}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={headingId} className="inline-flex flex-wrap items-baseline gap-2 font-display text-base font-semibold">
              <span>{ref ? refLabel : recipientLabel}</span>
              {ref && <span dir="ltr" className="font-mono text-lg font-bold tabular-nums">{ref}</span>}
            </h2>
            <button
              type="button"
              onClick={() => onPrintRequest?.()}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background print:hidden"
            >
              <Printer className="size-4 shrink-0" aria-hidden />
              <span>{printLabel}</span>
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-md border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">{recipientLabel}</p>
              <p className="font-display text-lg font-bold leading-snug">{recipientName}</p>
              <p className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-muted-foreground">{phoneLabel}</span>
                <span dir="ltr" className="select-text font-mono font-semibold tabular-nums">{recipientPhone}</span>
              </p>
              <p className="pt-1 text-xs font-semibold text-muted-foreground">{addressLabel}</p>
              <Address governorate={snapshotGovernorate} city={snapshotCity} street={snapshotStreetAddress} notes={snapshotBuildingNotes} />
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">{pickupLabel}</p>
              <Address governorate={pickupGovernorate} city={pickupCity} street={pickupStreetAddress} notes={pickupBuildingNotes} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
