/**
 * StatusBadge color map — brief §5.5 enum → color (DS-REGEN patch).
 *
 * Maps every status enum value to a { bg, fg } Tailwind class pair
 * drawn from the BETK design token set (globals.css).
 *
 * DS-REGEN changes vs main (values only, keys/types untouched):
 *  - warning tints now pair with text-warning-text (contrast token, §2.2)
 *  - dispatched/processing/in-review states → the additive --info pair (§2.4b)
 *  - delivered/processed → primary/12 tint (§5.5)
 *  - boost.active → SOLID accent "boosted" pill (§5.5)
 *  - seller.banned → destructive/12 tint (§5.5; was solid)
 *
 * The StatusBadge component (components/shared/) consumes this map.
 * Do NOT add component logic here — values only.
 */

import type {
  OrderStatus,
  SellerStatus,
  DisputeStatus,
  PaymentStatus,
  BoostStatus,
  ListingStatus,
  FlagStatus,
  PayoutStatus,
  InquiryStatus,
} from "@/constants/enums";

export type StatusColorPair = {
  bg: string;
  fg: string;
};

/* ── order_status ─────────────────────────────────────────── */
export const orderStatusColors: Record<OrderStatus, StatusColorPair> = {
  pending:     { bg: "bg-warning/15",     fg: "text-warning-text" },
  confirmed:   { bg: "bg-success/15",     fg: "text-success" },
  preparing:   { bg: "bg-warning/15",     fg: "text-warning-text" },
  dispatched:  { bg: "bg-info/[0.12]",    fg: "text-info" },
  delivered:   { bg: "bg-primary/[0.12]", fg: "text-primary" },
  cancelled:   { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
  returned:    { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
};

/* ── seller_status ────────────────────────────────────────── */
export const sellerStatusColors: Record<SellerStatus, StatusColorPair> = {
  pending:    { bg: "bg-warning/15",     fg: "text-warning-text" },
  active:     { bg: "bg-success/15",     fg: "text-success" },
  suspended:  { bg: "bg-accent/15",      fg: "text-accent-text" },
  banned:     { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
};

/* ── dispute_status ───────────────────────────────────────── */
export const disputeStatusColors: Record<DisputeStatus, StatusColorPair> = {
  submitted:       { bg: "bg-info/[0.12]", fg: "text-info" },
  under_review:    { bg: "bg-info/[0.12]", fg: "text-info" },
  awaiting_seller: { bg: "bg-info/[0.12]", fg: "text-info" },
  resolved:        { bg: "bg-success/15",  fg: "text-success" },
  closed:          { bg: "bg-muted/80",    fg: "text-muted-foreground" },
};

/* ── payment_status ───────────────────────────────────────── */
export const paymentStatusColors: Record<PaymentStatus, StatusColorPair> = {
  pending:   { bg: "bg-warning/15",     fg: "text-warning-text" },
  confirmed: { bg: "bg-success/15",     fg: "text-success" },
  failed:    { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
  refunded:  { bg: "bg-muted/80",       fg: "text-muted-foreground" },
};

/* ── boost_status ─────────────────────────────────────────── */
export const boostStatusColors: Record<BoostStatus, StatusColorPair> = {
  pending_payment: { bg: "bg-warning/15",  fg: "text-warning-text" },
  active:          { bg: "bg-accent",      fg: "text-accent-foreground" },
  expired:         { bg: "bg-muted/80",    fg: "text-muted-foreground" },
  cancelled:       { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
};

/* ── listing_status ───────────────────────────────────────── */
export const listingStatusColors: Record<ListingStatus, StatusColorPair> = {
  draft:     { bg: "bg-muted",           fg: "text-muted-foreground" },
  active:    { bg: "bg-success/15",      fg: "text-success" },
  sold_out:  { bg: "bg-destructive/10",  fg: "text-destructive" },
  paused:    { bg: "bg-muted",           fg: "text-muted-foreground" },
  removed:   { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
};

/* ── flag_status ──────────────────────────────────────────── */
export const flagStatusColors: Record<FlagStatus, StatusColorPair> = {
  pending:   { bg: "bg-warning/15",      fg: "text-warning-text" },
  reviewed:  { bg: "bg-primary/[0.12]",  fg: "text-primary" },
  actioned:  { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
  dismissed: { bg: "bg-muted/80",        fg: "text-muted-foreground" },
};

/* ── payout_status ────────────────────────────────────────── */
export const payoutStatusColors: Record<PayoutStatus, StatusColorPair> = {
  pending:    { bg: "bg-warning/15",     fg: "text-warning-text" },
  processing: { bg: "bg-info/[0.12]",    fg: "text-info" },
  processed:  { bg: "bg-primary/[0.12]", fg: "text-primary" },
  rejected:   { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
};

/* ── inquiry_status (Phase 06 / T03) ─────────────────────────
 * open/replied are in-progress (info/warning tints); confirmed is the
 * checkout-enablement state (success); declined/expired are terminal
 * read-only states (destructive/muted). */
export const inquiryStatusColors: Record<InquiryStatus, StatusColorPair> = {
  open:      { bg: "bg-warning/15",      fg: "text-warning-text" },
  replied:   { bg: "bg-info/[0.12]",     fg: "text-info" },
  confirmed: { bg: "bg-success/15",      fg: "text-success" },
  declined:  { bg: "bg-destructive/[0.12]", fg: "text-destructive" },
  expired:   { bg: "bg-muted/80",        fg: "text-muted-foreground" },
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
  | "payout"
  | "inquiry";

export const statusColorMap: Record<StatusDomain, Record<string, StatusColorPair>> = {
  order:   orderStatusColors,
  seller:  sellerStatusColors,
  dispute: disputeStatusColors,
  payment: paymentStatusColors,
  boost:   boostStatusColors,
  listing: listingStatusColors,
  flag:    flagStatusColors,
  payout:  payoutStatusColors,
  inquiry: inquiryStatusColors,
};
