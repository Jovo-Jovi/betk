/**
 * Resend service — transactional email dispatch.
 *
 * Responsibility: deliver `notifications` rows where channel='email'
 * (order confirmations, dispute updates, seller approvals, payout notices).
 *
 * Fail-safe: if RESEND_API_KEY or RESEND_FROM_ADDRESS is not configured,
 * sendEmail logs a warning and returns — never throws.
 *
 * No business logic. Callers (Server Actions / cron) decide when and to whom.
 *
 * TODO(Phase 03+): map each EmailTemplateName to a rendered React Email
 * template and wire the real Resend emails.send() call.
 */
import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/configs/env";

// ---------------------------------------------------------------------------
// Template catalogue
// Keep in sync with notification use-cases in BETK_ERD §notifications.
// ---------------------------------------------------------------------------

/** All email template slugs used by the notifications dispatch system. */
export type EmailTemplateName =
  | "order_confirmed"
  | "order_dispatched"
  | "order_delivered"
  | "order_cancelled"
  | "seller_approved"
  | "seller_rejected"
  | "seller_suspended"
  | "dispute_opened"
  | "dispute_resolved"
  | "payment_confirmed"
  | "payout_processed"
  | "otp_verification"
  | "welcome";

/** Per-template variable shapes.  Callers pass vars: EmailTemplateVars[T]. */
export interface EmailTemplateVars {
  order_confirmed: { orderRef: string; buyerName: string; totalEgp: number };
  order_dispatched: { orderRef: string; trackingNumber?: string };
  order_delivered: { orderRef: string };
  order_cancelled: { orderRef: string; reason?: string };
  seller_approved: { storeName: string };
  seller_rejected: { storeName: string; reason?: string };
  seller_suspended: { storeName: string; reason: string };
  dispute_opened: { disputeRef: string; orderRef: string };
  dispute_resolved: { disputeRef: string; resolution: string };
  payment_confirmed: { orderRef: string; amountEgp: number };
  payout_processed: { amountEgp: number; payoutRef: string };
  otp_verification: { otp: string; expiresMinutes: number };
  welcome: { displayName?: string };
}

// ---------------------------------------------------------------------------
// Lazy client initialisation
// ---------------------------------------------------------------------------

let _client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Resend(apiKey);
  return _client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a transactional email via Resend.
 *
 * No-op (with console.warn) when RESEND_API_KEY or RESEND_FROM_ADDRESS is
 * absent — safe to call in local dev without Resend credentials.
 *
 * @param to       Recipient email address.
 * @param template Template slug from EmailTemplateName.
 * @param vars     Typed variables for the template.
 */
export async function sendEmail<T extends EmailTemplateName>(
  to: string,
  template: T,
  vars: EmailTemplateVars[T],
): Promise<void> {
  const client = getClient();
  const from = serverEnv.RESEND_FROM_ADDRESS;

  if (!client || !from) {
    console.warn(
      "[resend] RESEND_API_KEY/RESEND_FROM_ADDRESS not configured; email suppressed",
      { template, to },
    );
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[resend] DEV no-op — would send '${template}' to ${to}`, vars);
    return;
  }

  // TODO(Phase 03+): render React Email template and call client.emails.send().
  // Example shape:
  //   const { html } = render(<OrderConfirmedEmail {...(vars as EmailTemplateVars["order_confirmed"])} />);
  //   await client.emails.send({ from, to, subject: SUBJECTS[template], html });
  console.info(`[resend] '${template}' dispatched to ${to}`);
}
