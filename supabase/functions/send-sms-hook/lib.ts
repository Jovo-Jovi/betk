/**
 * send-sms-hook — pure, runtime-agnostic logic (Phase 02 / T01a).
 *
 * This module holds everything that is NOT tied to the Deno runtime or to the
 * Standard Webhooks library, so it is importable by the Vitest unit suite
 * (Node) AND by the Deno `index.ts` entrypoint. The only external dependency is
 * `zod`, resolved via `deno.json` (npm:zod) under Deno and via node_modules
 * under Vitest.
 *
 * Model A (ADR-010): GoTrue generates/verifies the OTP and owns sessions. This
 * function is DELIVERY-ONLY — it never generates, validates, stores, or owns any
 * OTP lifecycle. It receives a one-time OTP from GoTrue's Send SMS Hook and
 * hands the built message to TorvoSMS.
 *
 * SECURITY (AC-AUTH-2 extends here — hard-fail vectors):
 *   The raw OTP, the built message string (it CONTAINS the OTP), the TorvoSMS
 *   API key, and the full request body must NEVER be console.log'd, returned,
 *   persisted, or placed in a Sentry breadcrumb. On error we log ONLY the
 *   provider status/code + a non-sensitive message id. The structured `log`
 *   dependency below is the single logging seam and is given OTP-free data only.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Message template (BETK-branded Arabic, 60s expiry — R-A02)
// ---------------------------------------------------------------------------

/**
 * The one place the SMS copy lives. `{otp}` is interpolated by `buildMessage`.
 *
 * Wording matches the REAL GoTrue OTP expiry (60s / SMS_OTP_EXP). We deliberately
 * do NOT reuse the provider's sample "5 minutes" copy — it would contradict the
 * 60-second expiry and mislead the user.
 */
export const SMS_TEMPLATE =
  "كود التحقق الخاص بك في بيتك هو {otp} — صالح لمدة ٦٠ ثانية";

/** Interpolate the OTP into the BETK template. The result CONTAINS the OTP — never log it. */
export function buildMessage(otp: string): string {
  return SMS_TEMPLATE.replace("{otp}", otp);
}

// ---------------------------------------------------------------------------
// Payload (Zod) — GoTrue Send SMS Hook event
// ---------------------------------------------------------------------------

/**
 * GoTrue Send SMS Hook payload (the subset BETK consumes).
 * GoTrue may emit the phone with or without the leading `+`; we accept both and
 * canonicalise in `transformPhoneForTorvoSMS`.
 */
export const sendSmsHookPayloadSchema = z.object({
  user: z.object({
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/, "user.phone must be E.164 (optionally without +)"),
  }),
  sms: z.object({
    otp: z.string().trim().min(1, "sms.otp is required"),
  }),
});

export type SendSmsHookPayload = z.infer<typeof sendSmsHookPayloadSchema>;

// ---------------------------------------------------------------------------
// Phone transform
// ---------------------------------------------------------------------------

/** Egypt country code TorvoSMS expects in the `countryCode` body field. */
export const TORVOSMS_COUNTRY_CODE = "20";

/**
 * Normalise GoTrue's phone to the recipient form TorvoSMS expects.
 *
 * Live-tested (2026-06-27): sending the full international number (with or
 * without `+`) was accepted by the gateway (`status: sent`) but did NOT deliver.
 * TorvoSMS takes the bare NATIONAL number in `recipients` and the dialing code
 * separately in `countryCode`. So we strip the leading `+` and the country code,
 * sending e.g. `1001124312` + `countryCode: "20"` (the national leading zero is
 * already dropped in GoTrue's E.164). This is the single transform point.
 */
export function transformPhoneForTorvoSMS(phone: string): string {
  const digits = phone.trim().replace(/^\+/, "");
  return digits.startsWith(TORVOSMS_COUNTRY_CODE)
    ? digits.slice(TORVOSMS_COUNTRY_CODE.length)
    : digits;
}

// ---------------------------------------------------------------------------
// Provider send result + response mapping
// ---------------------------------------------------------------------------

export interface SmsSendSuccess {
  ok: true;
  /** Non-sensitive provider message id, if returned. Safe to log. */
  messageId?: string;
}

export interface SmsSendFailure {
  ok: false;
  /** HTTP status to surface to GoTrue (non-2xx). */
  status: number;
  /** Non-sensitive provider error code, if any. Safe to log. */
  providerCode?: string | number;
  /** Non-sensitive provider status text, if any. Safe to log. */
  providerStatus?: string;
}

export type SmsSendResult = SmsSendSuccess | SmsSendFailure;

/**
 * Map a TorvoSMS HTTP response into a typed result.
 *
 * Defensive because the exact success indicator is unconfirmed: many SMS REST
 * gateways return HTTP 200 with an in-body error (auth failure, insufficient
 * credit, invalid number). We therefore treat BOTH a non-2xx status AND a
 * recognised in-body error signal as failure.
 *
 * TODO(confirm against TorvoSMS API docs): the canonical success/failure field
 * names; tighten this mapping once the response schema is known.
 */
export function mapTorvoSMSResponse(httpStatus: number, body: unknown): SmsSendResult {
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ok: false, status: httpStatus, providerStatus: `http_${httpStatus}` };
  }

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;

    const explicitFailure =
      b.success === false ||
      b.success === "false" ||
      b.status === "error" ||
      b.status === "failed" ||
      (typeof b.code === "number" && b.code !== 0 && b.code !== 200) ||
      b.error != null;

    if (explicitFailure) {
      const providerCode =
        (typeof b.code === "number" || typeof b.code === "string" ? b.code : undefined) ??
        (typeof b.errorCode === "string" ? b.errorCode : undefined);
      const providerStatus = typeof b.status === "string" ? b.status : "provider_error";
      // Map an in-body error on a 2xx envelope to a 502 (provider rejected delivery).
      return { ok: false, status: 502, providerCode, providerStatus };
    }

    const messageId =
      pickString(b.message_id) ??
      pickString(b.messageId) ??
      pickString(b.id) ??
      pickString(b.sms_id);
    return messageId ? { ok: true, messageId } : { ok: true };
  }

  // Non-JSON 2xx response — treat as success.
  return { ok: true };
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// ---------------------------------------------------------------------------
// TorvoSMS sender
// ---------------------------------------------------------------------------

export interface TorvoSMSConfig {
  /** TorvoSMS REST base URL, from env TORVOSMS_BASE_URL (e.g. https://smsapi.torvochat.com). */
  baseUrl: string;
  /** TorvoSMS API key, from env TORVOSMS_API_KEY. Secret — never log. Sent as `x-api-key`. */
  apiKey: string;
  /** Approved TorvoSMS sender id, from env TORVOSMS_SENDER_ID. */
  senderId: string;
}

/** Confirmed TorvoSMS send path, appended to the configured base URL. */
export const TORVOSMS_SEND_PATH = "/sms/send";

/**
 * Build the TorvoSMS delivery function. `fetchImpl` is injectable so tests mock
 * it and never hit the live API.
 *
 * Confirmed REST contract:
 *   POST <baseUrl>/sms/send
 *   headers: x-api-key: <apiKey>, Content-Type: application/json
 *   body:    { countryCode: "20", recipients: [<phone>], message, senderId }
 *
 * Full-message-string shape: the recipient phone + the already-built message
 * (which contains the OTP) are posted. The OTP + API key necessarily travel to
 * the provider here — that is the whole point — but they are NEVER logged or
 * returned.
 */
export function createTorvoSMSSender(
  config: TorvoSMSConfig,
  fetchImpl: typeof fetch = fetch,
): (phone: string, message: string) => Promise<SmsSendResult> {
  // Tolerate a trailing slash on the configured base URL.
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}${TORVOSMS_SEND_PATH}`;

  return async (phone, message) => {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Confirmed: TorvoSMS authenticates via the `x-api-key` header (NOT
        // Bearer). The key is read from env (TORVOSMS_API_KEY) — NEVER hard-coded.
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        countryCode: TORVOSMS_COUNTRY_CODE,
        // `recipients` is an array; a single E.164 number for the OTP send.
        recipients: [phone],
        message,
        senderId: config.senderId,
      }),
    });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON body on a 2xx is treated as success by mapTorvoSMSResponse.
    }

    return mapTorvoSMSResponse(res.status, body);
  };
}

// ---------------------------------------------------------------------------
// Request handler (runtime-agnostic)
// ---------------------------------------------------------------------------

export interface LogEntry {
  level: "info" | "error";
  event: string;
  /** Only ever non-sensitive provider metadata. NEVER the OTP/message/key/body. */
  messageId?: string;
  providerCode?: string | number;
  providerStatus?: string;
}

export interface HandlerDeps {
  /**
   * Verifies the Standard Webhooks signature over the RAW request body and
   * returns the parsed payload on success; THROWS on signature failure. This is
   * the first thing applied to the request — nothing parses/acts on the body
   * before it succeeds.
   */
  verify: (rawBody: string, headers: Record<string, string>) => unknown;
  /** Delivers the already-built message via the provider. */
  sendSms: (phone: string, message: string) => Promise<SmsSendResult>;
  /** OTP-free structured logger. Defaults to a no-op. */
  log?: (entry: LogEntry) => void;
}

/** GoTrue auth-hook error contract: `{ error: { http_code, message } }`. Message is non-sensitive. */
function errorResponse(httpCode: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  const log = deps.log ?? (() => {});

  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed");
  }

  // (1) Read the RAW body ONLY to compute the HMAC. We do NOT JSON-parse,
  //     interpret, or act on it before the signature is verified.
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  // (2) SIGNATURE VERIFICATION FIRST. On failure → 401, payload never parsed.
  let verified: unknown;
  try {
    verified = deps.verify(rawBody, headers);
  } catch {
    log({ level: "error", event: "signature_verification_failed" });
    return errorResponse(401, "invalid_signature");
  }

  // (3) Zod-validate the now-trusted payload.
  const parsed = sendSmsHookPayloadSchema.safeParse(verified);
  if (!parsed.success) {
    // Do NOT include the issues — they can echo payload values (the OTP).
    log({ level: "error", event: "invalid_payload" });
    return errorResponse(400, "invalid_payload");
  }

  const phone = transformPhoneForTorvoSMS(parsed.data.user.phone);
  const message = buildMessage(parsed.data.sms.otp);

  // (4) Deliver. Never log `phone`+otp pairing or `message`.
  let result: SmsSendResult;
  try {
    result = await deps.sendSms(phone, message);
  } catch {
    log({ level: "error", event: "provider_request_failed" });
    return errorResponse(502, "sms_delivery_failed");
  }

  if (!result.ok) {
    log({
      level: "error",
      event: "provider_rejected",
      providerStatus: result.providerStatus,
      providerCode: result.providerCode,
    });
    const status = result.status >= 400 && result.status < 600 ? result.status : 502;
    return errorResponse(status, "sms_delivery_failed");
  }

  log({ level: "info", event: "sms_delivered", messageId: result.messageId });

  // (5) GoTrue success contract: HTTP 200 with a JSON body. GoTrue parses the
  //     hook response as application/json and rejects an empty/text-plain body
  //     (error_code `hook_payload_invalid_content_type`), so return `{}`
  //     explicitly with the JSON content-type. Body carries no OTP/message.
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
