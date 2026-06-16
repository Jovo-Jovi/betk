# src/configs/

Environment and runtime configuration:

| File | Contents |
|---|---|
| `env.ts` | Zod-validated env loader — parses `process.env` against `docs/08-deployment/BETK_CONFIGURATION.md`; throws on missing required vars; never exposes service-role key to the client bundle |

Add additional config modules here (e.g. feature flags, rate-limit thresholds) as separate files. Feature folders map to UI Spec areas — see `src/features/README.md`.
