# skill-security-reviewer.md
**Owns:** auth flows, RLS audit, Zod validation coverage.

Review checklist (block merge on any failure):
- Auth: phone-OTP + Google OAuth (OD-4); OTP hashed, 60s expiry, ≤5 attempts (R-A02); session tokens hashed; suspended/banned/deactivated (`deleted_at`) blocked (R-A05); phone read-only post-verify (R-A06). Verify the **transaction gate**: checkout/become-seller/payout require `users.phone_number IS NOT NULL` (Server Action + RLS WITH CHECK).
- RLS: every touched table has policies; default-deny holds; service-role paths re-check ownership; no client uses the service key.
- Zod: every Server Action and API route validates input before DB access. No unvalidated `formData`/`body` reaches Supabase.
- Storage: `seller_documents` private; signed URLs ≤15 min; never a public doc URL (C3 §8.2 RISK 5).
- The 5 pre-launch risks (C3 §8.2): WhatsApp template change logging (RISK 1); CHECK constraints on numeric `admin_settings` keys (RISK 2); polymorphic `flagged_content.content_id` validation trigger (RISK 3); service_role bypass tested for jobs (RISK 4); private docs bucket (RISK 5).
- No secrets in code/logs/URLs. Audit-log all admin actions (`moderation_logs`, R-M02).
- OWASP basics: authz on every mutation, output encoding (RTL-safe), rate limiting on OTP/inquiry/search (`RATE_LIMITING.md`).
