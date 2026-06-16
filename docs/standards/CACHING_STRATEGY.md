# CACHING_STRATEGY.md
> Next.js revalidate / unstable_cache / Supabase query caching.

- Homepage (collections + new arrivals + featured): cache 60s (Edge/`revalidate`), per C3 §8.3.
- `rating_aggregates`: 5-min TTL (read 10x more than written). Storefront/listing cards read it constantly.
- Use `revalidateTag` keyed by `store:{id}` / `listing:{id}` on writes (publish, review, status change) to invalidate precisely.
- Search results: short cache keyed by normalized query+filters; don't cache personalized/auth views.
- Never cache buyer-private data (orders, inbox, notifications) cross-user. Respect RLS scoping in cache keys.
