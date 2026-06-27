/**
 * send-sms-hook tests (Phase 02 / T01a) — Vitest, Node runtime.
 *
 * Tests target the runtime-agnostic logic in ./lib.ts. The TorvoSMS fetch is
 * ALWAYS mocked — these tests never hit the live API. The Standard Webhooks
 * verification is injected (the `verify` dep), so we exercise both the
 * signature-pass and signature-fail paths without the standardwebhooks library.
 *
 * Coverage:
 *   (a) signature-fail → 401 and the body is never parsed/delivered
 *   (b) phone transform correct
 *   (c) provider success → 200 with `{}` (application/json) body
 *   (d) provider failure → non-200 typed error
 *   (e) CRITICAL: the raw OTP and the built message never appear in any logged
 *       or returned string
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildMessage,
  createTorvoSMSSender,
  handleRequest,
  mapTorvoSMSResponse,
  transformPhoneForTorvoSMS,
  type HandlerDeps,
  type LogEntry,
} from "./lib";

const OTP = "654321";
const PHONE_E164 = "+201001234567";

/** A valid GoTrue Send SMS Hook payload. */
function validPayload(phone = PHONE_E164, otp = OTP) {
  return { user: { phone }, sms: { otp } };
}

/** Build a POST Request with a JSON body + Standard Webhooks-ish headers. */
function makeRequest(body: unknown): Request {
  return new Request("https://hook.local/send-sms-hook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": "msg_test",
      "webhook-timestamp": "1700000000",
      "webhook-signature": "v1,deadbeef",
    },
    body: JSON.stringify(body),
  });
}

/** A capturing logger + the entries it received. */
function makeLogger() {
  const entries: LogEntry[] = [];
  const log = (entry: LogEntry) => entries.push(entry);
  return { log, entries };
}

describe("send-sms-hook · helpers", () => {
  it("(b) transforms phone to bare NATIONAL digits (strips + and the 20 country code)", () => {
    expect(transformPhoneForTorvoSMS("+201001234567")).toBe("1001234567");
    expect(transformPhoneForTorvoSMS("201001234567")).toBe("1001234567");
    expect(transformPhoneForTorvoSMS("  +201001234567  ")).toBe("1001234567");
  });

  it("builds the BETK Arabic message with the 60s wording and no leftover token", () => {
    const msg = buildMessage(OTP);
    expect(msg).toContain(OTP);
    expect(msg).toContain("بيتك");
    expect(msg).toContain("٦٠");
    expect(msg).not.toContain("{otp}");
    expect(msg).not.toContain("5 minutes");
  });

  it("maps provider responses: 2xx→ok, non-2xx→fail, in-body error→fail", () => {
    expect(mapTorvoSMSResponse(200, { id: "abc" })).toEqual({ ok: true, messageId: "abc" });
    expect(mapTorvoSMSResponse(200, null)).toEqual({ ok: true });
    expect(mapTorvoSMSResponse(401, null)).toMatchObject({ ok: false, status: 401 });
    expect(mapTorvoSMSResponse(200, { success: false, code: 7 })).toMatchObject({
      ok: false,
      providerCode: 7,
    });
    expect(mapTorvoSMSResponse(200, { error: "insufficient_credit" })).toMatchObject({
      ok: false,
    });
  });
});

describe("send-sms-hook · handleRequest", () => {
  it("(a) signature failure → 401 and the body is never parsed or delivered", async () => {
    const { log, entries } = makeLogger();
    const sendSms = vi.fn();
    const verify = vi.fn(() => {
      throw new Error("invalid signature");
    });
    const deps: HandlerDeps = { verify, sendSms, log };

    const res = await handleRequest(makeRequest(validPayload()), deps);

    expect(res.status).toBe(401);
    // Body never acted on: provider never called.
    expect(sendSms).not.toHaveBeenCalled();
    // The only log is the signature failure event — no payload echo.
    expect(entries).toEqual([{ level: "error", event: "signature_verification_failed" }]);
    // Returned body must not leak the OTP.
    const text = await res.text();
    expect(text).not.toContain(OTP);
  });

  it("(c) provider success → 200 with `{}` (application/json) body (GoTrue contract)", async () => {
    const { log } = makeLogger();
    const verify = vi.fn(() => validPayload());
    const sendSms = vi.fn(async () => ({ ok: true as const, messageId: "msg_123" }));

    const res = await handleRequest(makeRequest(validPayload()), { verify, sendSms, log });

    expect(res.status).toBe(200);
    // GoTrue parses the hook response as JSON: must be `{}` with a JSON content-type.
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.text()).toBe("{}");
    // Provider received the bare-international phone + the built message.
    expect(sendSms).toHaveBeenCalledWith(transformPhoneForTorvoSMS(PHONE_E164), buildMessage(OTP));
  });

  it("(d) provider failure → non-200 typed error (no OTP/message in body)", async () => {
    const { log } = makeLogger();
    const verify = vi.fn(() => validPayload());
    const sendSms = vi.fn(async () => ({
      ok: false as const,
      status: 402,
      providerCode: "insufficient_credit",
      providerStatus: "error",
    }));

    const res = await handleRequest(makeRequest(validPayload()), { verify, sendSms, log });

    expect(res.status).toBe(402);
    const json = (await res.json()) as { error: { http_code: number; message: string } };
    expect(json.error.http_code).toBe(402);
    expect(json.error.message).toBe("sms_delivery_failed");
  });

  it("(d2) provider throw → 502 typed error", async () => {
    const { log } = makeLogger();
    const verify = vi.fn(() => validPayload());
    const sendSms = vi.fn(async () => {
      throw new Error("network down");
    });

    const res = await handleRequest(makeRequest(validPayload()), { verify, sendSms, log });
    expect(res.status).toBe(502);
  });

  it("rejects non-POST with 405", async () => {
    const verify = vi.fn(() => validPayload());
    const sendSms = vi.fn();
    const req = new Request("https://hook.local/send-sms-hook", { method: "GET" });
    const res = await handleRequest(req, { verify, sendSms });
    expect(res.status).toBe(405);
    expect(verify).not.toHaveBeenCalled();
  });

  it("invalid payload (post-verify) → 400 without echoing values", async () => {
    const { log, entries } = makeLogger();
    const verify = vi.fn(() => ({ user: { phone: "not-a-phone" }, sms: {} }));
    const sendSms = vi.fn();

    const res = await handleRequest(makeRequest({ bad: true }), { verify, sendSms, log });

    expect(res.status).toBe(400);
    expect(sendSms).not.toHaveBeenCalled();
    expect(entries).toEqual([{ level: "error", event: "invalid_payload" }]);
    expect(await res.text()).not.toContain("not-a-phone");
  });
});

describe("send-sms-hook · CRITICAL no-leak (e)", () => {
  it("never logs or returns the raw OTP or the built message across success + failure paths", async () => {
    const message = buildMessage(OTP);

    for (const provider of [
      async () => ({ ok: true as const, messageId: "msg_x" }),
      async () => ({
        ok: false as const,
        status: 402,
        providerCode: "insufficient_credit",
        providerStatus: "error",
      }),
    ]) {
      const { log, entries } = makeLogger();
      const verify = vi.fn(() => validPayload());
      const res = await handleRequest(makeRequest(validPayload()), {
        verify,
        sendSms: provider,
        log,
      });

      // No log entry may contain the OTP or the message text anywhere.
      const serialisedLogs = JSON.stringify(entries);
      expect(serialisedLogs).not.toContain(OTP);
      expect(serialisedLogs).not.toContain(message);

      // No returned body may contain the OTP or the message text.
      const body = await res.text();
      expect(body).not.toContain(OTP);
      expect(body).not.toContain(message);
    }
  });

  it("posts the confirmed TorvoSMS contract (/sms/send, x-api-key, countryCode/recipients[]/message/senderId) without logging secrets", async () => {
    const message = buildMessage(OTP);
    const apiKey = "secret-torvosms-key";
    const senderId = "BETK";

    // Mock fetch — never hits the network.
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg_provider" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const send = createTorvoSMSSender(
      // Trailing slash on the base URL must be tolerated.
      { baseUrl: "https://smsapi.torvochat.com/", apiKey, senderId },
      fetchMock as unknown as typeof fetch,
    );
    const recipient = transformPhoneForTorvoSMS(PHONE_E164); // bare international, as handleRequest passes it
    const result = await send(recipient, message);

    expect(result).toEqual({ ok: true, messageId: "msg_provider" });

    // (1) POST goes to <base>/sms/send.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://smsapi.torvochat.com/sms/send");
    expect(init.method).toBe("POST");

    // (2) x-api-key header present (and NOT a Bearer Authorization).
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(apiKey);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();

    // (3) Body shape: countryCode "20", recipients ARRAY, message, senderId.
    const sentBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sentBody.countryCode).toBe("20");
    expect(sentBody.recipients).toEqual([recipient]);
    expect(sentBody.message).toBe(message);
    expect(sentBody.senderId).toBe(senderId);
    // Old defaults must be gone.
    expect(sentBody.to).toBeUndefined();
    expect(sentBody.api_key).toBeUndefined();

    // The OUTBOUND request body legitimately carries the message (with OTP);
    // the key rides in the x-api-key header, asserted above — never in the body.
    const rawBody = String(init.body);
    expect(rawBody).toContain(OTP);
    expect(rawBody).not.toContain(apiKey);

    // …but the sender itself logs NOTHING (no console output containing secrets).
    const allConsole = [consoleSpy, consoleInfo, consoleErr]
      .flatMap((s) => s.mock.calls)
      .map((c) => c.join(" "))
      .join(" ");
    expect(allConsole).not.toContain(OTP);
    expect(allConsole).not.toContain(message);
    expect(allConsole).not.toContain(apiKey);
    expect(allConsole).not.toContain(senderId);

    consoleSpy.mockRestore();
    consoleInfo.mockRestore();
    consoleErr.mockRestore();
  });
});
