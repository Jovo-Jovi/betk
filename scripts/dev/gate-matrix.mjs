// PERF-02 gate-regression matrix — runtime proof of the middleware guest
// fast-path. Mints staging users, captures REAL @supabase/ssr session cookies
// (by signing in through a server client with an in-memory cookie jar), then
// probes {routes} × {roles} × {locales} against a running `next start`,
// recording status + Location per cell. Run:
//   node --env-file=.env.local scripts/dev/gate-matrix.mjs <baseUrl>
// Cleans up all minted users on exit.

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] ?? "http://localhost:4322";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("Missing Supabase creds in env.");
  process.exit(1);
}
const REF = new URL(URL_).hostname.split(".")[0];
const AUTH_COOKIE = `sb-${REF}-auth-token`;
const RUN = Math.random().toString(36).slice(2, 8);

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const betk = () => service.schema("betk");

const ROUTES = ["/", "/account", "/seller", "/seller/status", "/seller/onboarding", "/admin"];
const LOCALES = ["ar", "en"];
const localize = (loc, p) => (loc === "ar" ? p : p === "/" ? "/en" : `/en${p}`);

const createdAuthIds = [];

async function mintUser(label, { role, sellerStatus }) {
  const email = `betk-gate-${label}-${RUN}@betk.test`;
  const password = `Pw-${RUN}-${label}!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await betk()
    .from("users")
    .insert({ id, phone_number: `01${RUN}${label.slice(0, 2)}`, auth_provider: "phone", role, status: "active" });
  if (uErr) throw new Error(`users(${label}): ${uErr.message}`);

  if (role === "seller") {
    const { error: spErr } = await betk()
      .from("seller_profiles")
      .insert({ id, status: sellerStatus });
    if (spErr) throw new Error(`seller_profiles(${label}): ${spErr.message}`);
  }

  // Capture real @supabase/ssr cookies by signing in through a jar-backed client.
  const jar = new Map();
  const client = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn(${label}): ${signErr.message}`);
  const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
  if (!cookieHeader.includes(AUTH_COOKIE)) throw new Error(`no auth cookie captured for ${label}`);
  return cookieHeader;
}

async function probe(cookie, loc, path) {
  const res = await fetch(`${BASE}${localize(loc, path)}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const location = res.headers.get("location");
  return `${res.status}${location ? ` → ${location}` : ""}`;
}

async function main() {
  const roles = {
    "guest-no-cookies": "",
    "guest-garbage-cookie": `${AUTH_COOKIE}=garbage-not-a-jwt`,
    buyer: await mintUser("buyer", { role: "buyer" }),
    "pending-seller": await mintUser("pending", { role: "seller", sellerStatus: "pending" }),
    "active-seller": await mintUser("active", { role: "seller", sellerStatus: "active" }),
  };

  for (const loc of LOCALES) {
    console.log(`\n===== LOCALE: ${loc} =====`);
    const header = ["role".padEnd(22), ...ROUTES.map((r) => r.padEnd(20))].join("| ");
    console.log(header);
    console.log("-".repeat(header.length));
    for (const [role, cookie] of Object.entries(roles)) {
      const cells = [];
      for (const path of ROUTES) {
        cells.push((await probe(cookie, loc, path)).padEnd(20));
      }
      console.log([role.padEnd(22), ...cells].join("| "));
    }
  }
}

async function cleanup() {
  for (const id of createdAuthIds) {
    await betk().from("seller_profiles").delete().eq("id", id);
    await betk().from("users").delete().eq("id", id);
    await service.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

main()
  .catch((e) => {
    console.error("GATE-MATRIX ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
