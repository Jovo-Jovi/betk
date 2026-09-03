/**
 * buyer-account feature — shared narrow client type (MessagingClient /
 * CheckoutClient precedent). Kept minimal so both the `@supabase/ssr` cookie
 * client and a plain authenticated client (integration tests) satisfy it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type BuyerAccountClient = Pick<SupabaseClient<Database>, "schema" | "auth">;
