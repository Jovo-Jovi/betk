/**
 * send-sms-hook — Deno Edge Function entrypoint (Phase 02 / T01a, GATED · Opus).
 *
 * Supabase GoTrue "Send SMS Hook": GoTrue calls this on every phone-OTP send.
 * It is an UNAUTHENTICATED public endpoint (runs BEFORE a JWT exists → deployed
 * with --no-verify-jwt), so the Standard Webhooks signature is the ONLY trust
 * boundary and is verified FIRST, before the body is parsed or acted on.
 *
 * DELIVERY-ONLY (ADR-010 / Model A): GoTrue generates/verifies the OTP and owns
 * sessions. This function never generates, validates, stores, or owns any OTP
 * lifecycle — it interpolates GoTrue's one-time OTP into the BETK Arabic message
 * and posts it to TorvoSMS (REST, full-message-string shape).
 *
 * SECURITY (AC-AUTH-2 — hard-fail vectors): the raw OTP, the built message (it
 * contains the OTP), the TorvoSMS API key, and the full request body are NEVER
 * console.log'd, returned, persisted, or breadcrumbed. The structured logger
 * below emits only the event + non-sensitive provider status/code/message id.
 * All secrets are read from Edge Function env (Deno.env) — NEVER hard-coded.
 *
 * Runtime-only file: the testable logic lives in ./lib.ts (imported by Vitest).
 */

import { Webhook } from "standardwebhooks";
import {
  createTorvoSMSSender,
  handleRequest,
  type HandlerDeps,
  type LogEntry,
  type TorvoSMSConfig,
} from "./lib.ts";

// Deno's ambient global isn't visible to TS tooling outside Deno; declare the
// narrow slice we use so this file is self-describing.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

/** Read a required Edge Function secret or throw at startup (fail fast). */
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[send-sms-hook] missing required secret: ${name}`);
  return value;
}

// --- Secrets / config (Edge Function env only; never in repo) ---------------
// SEND_SMS_HOOK_SECRET is the Standard Webhooks secret in the form
// `v1,whsec_<base64>`; the standardwebhooks Webhook constructor wants the bare
// base64, so strip the prefix.
const HOOK_SECRET = requireEnv("SEND_SMS_HOOK_SECRET").replace("v1,whsec_", "");
const TORVOSMS_CONFIG: TorvoSMSConfig = {
  baseUrl: requireEnv("TORVOSMS_BASE_URL"),
  apiKey: requireEnv("TORVOSMS_API_KEY"),
  senderId: requireEnv("TORVOSMS_SENDER_ID"),
};

const webhook = new Webhook(HOOK_SECRET);

/** OTP-free structured logger. Only ever receives non-sensitive metadata. */
function log(entry: LogEntry): void {
  // JSON line keeps logs greppable in the Supabase dashboard. `entry` is built
  // exclusively from non-sensitive fields by handleRequest — no OTP/message/key.
  const line = JSON.stringify({ fn: "send-sms-hook", ...entry });
  if (entry.level === "error") console.error(line);
  else console.info(line);
}

const deps: HandlerDeps = {
  // standardwebhooks.verify(rawBody, headers) returns the parsed payload on a
  // valid signature and THROWS otherwise — exactly the contract handleRequest
  // expects (verify-before-parse).
  verify: (rawBody, headers) => webhook.verify(rawBody, headers),
  sendSms: createTorvoSMSSender(TORVOSMS_CONFIG),
  log,
};

Deno.serve((req: Request) => handleRequest(req, deps));
