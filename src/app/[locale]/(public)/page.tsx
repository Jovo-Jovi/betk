/**
 * Homepage (`/` in ar, `/en` in en) — a PUBLIC route, so it lives inside the
 * (public) group and is wrapped by PublicShell (which already provides <main>).
 *
 * OD-7 note: the homepage MUST stay inside (public) rather than at the [locale]
 * root. Its Suspense/loading boundary is (public)/loading.tsx, which does NOT
 * wrap the sibling [locale]/[...rest] catch-all — so unknown paths still commit
 * a genuine 404 instead of a streamed soft-200.
 *
 * Placeholder content — the real landing UI arrives in Phase 03 (discovery).
 */
export default function HomePage() {
  return null;
}
