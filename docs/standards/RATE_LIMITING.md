# RATE_LIMITING.md
> API protection, abuse prevention, Supabase limits.

- **OTP:** per-phone + per-IP throttle on request/verify; ≤5 verify attempts/token (R-A02); cooldown on resend (60s). Hard daily cap per phone.
- **Inquiries / messages:** per-buyer rate cap to prevent spam to sellers.
- **Search:** per-IP cap; debounce client-side.
- **Boost/payout/dispute creation:** per-user caps; dedupe rapid double-submits.
- **Implementation:** middleware + a counter store (Supabase table or edge KV). Return `RATE_LIMITED`. Enable PgBouncer; respect Supabase connection/query limits (C3 §8.1).
