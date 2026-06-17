/**
 * StatusBadge color map — UI Spec §4 / C3 §2 enums
 *
 * Maps every status enum value to a { bg, fg } Tailwind class pair
 * drawn from the BETK design token set (globals.css).
 *
 * Rules:
 *  - terminal-success states → success token
 *  - in-flight / pending     → warning token
 *  - terminal-failure / risk → destructive token
 *  - neutral / draft         → muted token
 *  - active / approved       → primary token
 *  - promotional             → accent token
 *
 * The StatusBadge component (components/shared/) consumes this map.
 * Do NOT add component logic here — values only.
 */

export type StatusColorPair = {
  bg: string;
  fg: string;
};

/* ── order_status ─────────────────────────────────────────── */
export const orderStatusColors: Record<string, StatusColorPair> = {
  pending:     { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  confirmed:   { bg: "bg-primary/15",     fg: "text-primary" },
  preparing:   { bg: "bg-primary/15",     fg: "text-primary" },
  dispatched:  { bg: "bg-accent/15",      fg: "text-accent" },
  delivered:   { bg: "bg-success/15",     fg: "text-success" },
  cancelled:   { bg: "bg-destructive/15", fg: "text-destructive" },
  returned:    { bg: "bg-muted",          fg: "text-muted-foreground" },
};

/* ── seller_status ────────────────────────────────────────── */
export const sellerStatusColors: Record<string, StatusColorPair> = {
  pending:    { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  active:     { bg: "bg-success/15",     fg: "text-success" },
  suspended:  { bg: "bg-destructive/15", fg: "text-destructive" },
  banned:     { bg: "bg-destructive",    fg: "text-destructive-foreground" },
};

/* ── dispute_status ───────────────────────────────────────── */
export const disputeStatusColors: Record<string, StatusColorPair> = {
  submitted:       { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  under_review:    { bg: "bg-primary/15",     fg: "text-primary" },
  awaiting_seller: { bg: "bg-accent/15",      fg: "text-accent" },
  resolved:        { bg: "bg-success/15",     fg: "text-success" },
  closed:          { bg: "bg-muted",          fg: "text-muted-foreground" },
};

/* ── payment_status ───────────────────────────────────────── */
export const paymentStatusColors: Record<string, StatusColorPair> = {
  pending:   { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  confirmed: { bg: "bg-success/15",     fg: "text-success" },
  failed:    { bg: "bg-destructive/15", fg: "text-destructive" },
  refunded:  { bg: "bg-muted",          fg: "text-muted-foreground" },
};

/* ── boost_status ─────────────────────────────────────────── */
export const boostStatusColors: Record<string, StatusColorPair> = {
  pending_payment: { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  active:          { bg: "bg-accent/15",      fg: "text-accent" },
  expired:         { bg: "bg-muted",          fg: "text-muted-foreground" },
  cancelled:       { bg: "bg-destructive/15", fg: "text-destructive" },
};

/* ── listing_status ───────────────────────────────────────── */
export const listingStatusColors: Record<string, StatusColorPair> = {
  draft:     { bg: "bg-muted",          fg: "text-muted-foreground" },
  active:    { bg: "bg-success/15",     fg: "text-success" },
  sold_out:  { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  paused:    { bg: "bg-muted",          fg: "text-muted-foreground" },
  removed:   { bg: "bg-destructive/15", fg: "text-destructive" },
};

/* ── flag_status ──────────────────────────────────────────── */
export const flagStatusColors: Record<string, StatusColorPair> = {
  pending:   { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  reviewed:  { bg: "bg-primary/15",     fg: "text-primary" },
  actioned:  { bg: "bg-destructive/15", fg: "text-destructive" },
  dismissed: { bg: "bg-muted",          fg: "text-muted-foreground" },
};

/* ── payout_status ────────────────────────────────────────── */
export const payoutStatusColors: Record<string, StatusColorPair> = {
  pending:    { bg: "bg-warning/15",     fg: "text-warning-foreground" },
  processing: { bg: "bg-primary/15",     fg: "text-primary" },
  processed:  { bg: "bg-success/15",     fg: "text-success" },
  rejected:   { bg: "bg-destructive/15", fg: "text-destructive" },
};

/* ── Unified lookup (for StatusBadge component, Phase 02+) ── */
export type StatusDomain =
  | "order"
  | "seller"
  | "dispute"
  | "payment"
  | "boost"
  | "listing"
  | "flag"
  | "payout";

export const statusColorMap: Record<StatusDomain, Record<string, StatusColorPair>> = {
  order:   orderStatusColors,
  seller:  sellerStatusColors,
  dispute: disputeStatusColors,
  payment: paymentStatusColors,
  boost:   boostStatusColors,
  listing: listingStatusColors,
  flag:    flagStatusColors,
  payout:  payoutStatusColors,
};
