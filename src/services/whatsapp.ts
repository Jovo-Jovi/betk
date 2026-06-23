/**
 * WhatsApp service — approved-template message dispatch (R-N02).
 *
 * R-N02 enforcement: every sendTemplate call validates the requested template
 * name against the `betk.whatsapp_templates` table (is_active = true) before
 * proceeding.  Non-approved or inactive template names are rejected — the call
 * logs an error and returns without sending.
 *
 * Fail-safe: if WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID is absent, the call
 * logs a warning and returns — never throws.
 *
 * No business logic. Callers (Server Actions / notification dispatcher) build
 * the `vars` payload from domain data; this layer only dispatches.
 *
 * TODO(Phase 05 / notifications): implement the real WhatsApp Cloud API call:
 *   POST https://graph.facebook.com/v17.0/{phoneId}/messages
 */
import "server-only";
import { serverEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Component substitution variables for a WhatsApp template message. */
export type WhatsAppVars = Record<string, string>;

/** Shape of a resolved (approved) template row from the DB. */
interface ApprovedTemplate {
  name: string;
  language: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a single active template by name from betk.whatsapp_templates.
 * Returns null if the template does not exist or is inactive.
 * Implements R-N02: approved-template-only enforcement.
 */
async function fetchApprovedTemplate(
  name: string,
): Promise<ApprovedTemplate | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("whatsapp_templates")
    .select("name, language")
    .eq("name", name)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error(
      "[whatsapp] DB error while checking template approval",
      { name, error },
    );
    return null;
  }

  return data ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an approved WhatsApp template message via the WhatsApp Cloud API.
 *
 * R-N02: only templates present in `betk.whatsapp_templates` with
 * `is_active = true` are dispatched.  Unknown or inactive template names are
 * rejected with a console.error (not a throw) to prevent silent data leaks.
 *
 * No-op (with console.warn) when WHATSAPP_API_TOKEN / WHATSAPP_PHONE_ID are
 * not configured — safe to call in local dev.
 *
 * @param name  Template name matching a `betk.whatsapp_templates.name` row.
 * @param to    Recipient phone number in E.164 format (e.g. "+201001234567").
 * @param vars  Variable substitutions passed to the template body components.
 */
export async function sendTemplate(
  name: string,
  to: string,
  vars: WhatsAppVars = {},
): Promise<void> {
  const token = serverEnv.WHATSAPP_API_TOKEN;
  const phoneId = serverEnv.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn(
      "[whatsapp] WHATSAPP_API_TOKEN/WHATSAPP_PHONE_ID not configured; send suppressed",
      { name, to },
    );
    return;
  }

  // R-N02 — verify template is in the approved list before dispatching
  const template = await fetchApprovedTemplate(name);
  if (!template) {
    console.error(
      `[whatsapp] Template '${name}' not found in approved list (R-N02); send rejected`,
      { to },
    );
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[whatsapp] DEV no-op — would send approved template '${name}' (${template.language}) to ${to}`,
      vars,
    );
    return;
  }

  // TODO(Phase 05): real WhatsApp Cloud API call.
  // POST https://graph.facebook.com/v17.0/{phoneId}/messages
  // Headers: { Authorization: `Bearer ${token}` }
  // Body: {
  //   messaging_product: "whatsapp",
  //   to,
  //   type: "template",
  //   template: {
  //     name: template.name,
  //     language: { code: template.language },
  //     components: [{ type: "body", parameters: Object.values(vars).map(v => ({ type: "text", text: v })) }],
  //   },
  // }
  console.info(`[whatsapp] Template '${name}' dispatched to ${to}`);
}
