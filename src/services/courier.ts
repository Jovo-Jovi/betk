/**
 * Courier service — last-mile delivery via Bosta (Egypt).
 *
 * Provides typed wrappers over the Bosta API for shipment creation and
 * order tracking.  Bosta is Egypt's dominant B2C courier and the reference
 * provider in BETK_ARCHITECTURE.md §1.
 *
 * Fail-safe: if BOSTA_API_KEY is absent, all calls log a warning and return
 * safe fallback values — never throw.
 *
 * No business logic. Server Actions (Phase 06 / delivery) build the
 * BostaShipmentInput from order/address data and call these wrappers.
 *
 * TODO(Phase 06): implement real HTTP calls against the Bosta API v2:
 *   Base URL: https://app.bosta.co/api/v2
 *   Auth:     Authorization: {BOSTA_API_KEY}
 */
import "server-only";
import { serverEnv } from "@/configs/env";

// ---------------------------------------------------------------------------
// Bosta type definitions
// Reference: https://developer.bosta.co/docs
// ---------------------------------------------------------------------------

/** Bosta shipment type codes. */
export const BostaShipmentType = {
  SEND: 10,
  CASH_COLLECTION: 20,
  RETURN: 30,
} as const;

export type BostaShipmentTypeCode =
  (typeof BostaShipmentType)[keyof typeof BostaShipmentType];

/** Address shape used for both sender and recipient. */
export interface BostaAddress {
  /** Bosta city name (Arabic or English — must match Bosta's city list). */
  city: string;
  /** Optional zone / district within the city. */
  zone?: string;
  /** Human-readable street address. */
  address: string;
}

export interface BostaContact {
  /** Full name of the contact. */
  name: string;
  /** Phone number in Egyptian local format (e.g. "01012345678"). */
  phone: string;
  /** Address for pickup or delivery. */
  address: BostaAddress;
}

/** Input to createShipment — built by the orders/delivery Server Action. */
export interface BostaShipmentInput {
  /** BETK order reference — stored for reconciliation. */
  orderId: string;
  /** Bosta shipment type (SEND / CASH_COLLECTION / RETURN). */
  type: BostaShipmentTypeCode;
  /**
   * Cash on delivery amount in EGP.
   * Required when type = CASH_COLLECTION; ignored otherwise.
   */
  cod?: number;
  sender: BostaContact;
  recipient: BostaContact;
  /** Delivery notes shown to the courier. */
  notes?: string;
  /**
   * Number of packages in this shipment.
   * @default 1
   */
  packageCount?: number;
}

/** Result returned by createShipment. */
export interface BostaShipmentResult {
  /** Bosta tracking number — stored in betk.shipments.tracking_number. */
  trackingNumber: string;
  /** Bosta internal order id — stored in betk.shipments (future column). */
  bostaOrderId: string;
  /** ISO date string for estimated delivery, if provided by Bosta. */
  estimatedDeliveryDate?: string;
}

/** A single event in the Bosta tracking timeline. */
export interface BostaTrackingEvent {
  /** ISO date-time of the event. */
  timestamp: string;
  /** Bosta event code (e.g. "PACKAGE_RECEIVED", "OUT_FOR_DELIVERY"). */
  code: string;
  /** Human-readable description (Arabic or English per language param). */
  description: string;
  /** City / location where the event occurred. */
  location?: string;
}

/** Result returned by getTracking. */
export interface BostaTrackingResult {
  trackingNumber: string;
  /** Current status code from Bosta. Maps to betk.shipment_status enum. */
  status: string;
  /** Full timeline of tracking events, most recent first. */
  events: BostaTrackingEvent[];
  /** ISO date string for latest ETA, if known. */
  estimatedDeliveryDate?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Bosta shipment for a BETK order.
 *
 * No-op (with console.warn) when BOSTA_API_KEY is not configured.
 * Returns a stub result in that case so callers can continue without crashing.
 *
 * @param input  Shipment parameters — built by the orders/delivery Server Action.
 * @returns      Tracking number and Bosta order id to persist on betk.shipments.
 */
export async function createShipment(
  input: BostaShipmentInput,
): Promise<BostaShipmentResult> {
  const apiKey = serverEnv.BOSTA_API_KEY;

  if (!apiKey) {
    console.warn(
      "[courier] BOSTA_API_KEY not configured; shipment creation suppressed",
      { orderId: input.orderId },
    );
    return { trackingNumber: "", bostaOrderId: "" };
  }

  if (process.env.NODE_ENV !== "production") {
    const stub: BostaShipmentResult = {
      trackingNumber: `STUB-${input.orderId}`,
      bostaOrderId: `STUB-BOSTA-${Date.now()}`,
    };
    console.info(
      `[courier] DEV no-op — would create shipment for order ${input.orderId}`,
      stub,
    );
    return stub;
  }

  // TODO(Phase 06): real Bosta API call.
  // POST https://app.bosta.co/api/v2/deliveries
  // Headers: { Authorization: apiKey, "Content-Type": "application/json" }
  // Body: {
  //   type: input.type,
  //   cod: input.cod,
  //   specs: { packageDetails: { itemsCount: input.packageCount ?? 1 } },
  //   sender: { ...input.sender },
  //   receiver: { ...input.recipient },
  //   notes: input.notes,
  // }
  console.info(`[courier] Shipment created for order ${input.orderId}`);
  return { trackingNumber: "", bostaOrderId: "" }; // replaced by real response
}

/**
 * Fetch the current tracking status and event timeline for a Bosta shipment.
 *
 * No-op (with console.warn) when BOSTA_API_KEY is not configured.
 * Returns a safe empty result so callers can render a graceful fallback.
 *
 * @param trackingNumber  Bosta tracking number from betk.shipments.tracking_number.
 * @returns               Current status and full event timeline.
 */
export async function getTracking(
  trackingNumber: string,
): Promise<BostaTrackingResult> {
  const apiKey = serverEnv.BOSTA_API_KEY;

  if (!apiKey) {
    console.warn(
      "[courier] BOSTA_API_KEY not configured; tracking unavailable",
      { trackingNumber },
    );
    return { trackingNumber, status: "unavailable", events: [] };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[courier] DEV no-op — would fetch tracking for ${trackingNumber}`,
    );
    return { trackingNumber, status: "stub", events: [] };
  }

  // TODO(Phase 06): real Bosta API call.
  // GET https://app.bosta.co/api/v2/deliveries/track/{trackingNumber}
  // Headers: { Authorization: apiKey }
  console.info(`[courier] Tracking fetched for ${trackingNumber}`);
  return { trackingNumber, status: "unknown", events: [] }; // replaced by real response
}
