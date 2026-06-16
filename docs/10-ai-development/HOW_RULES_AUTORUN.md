# HOW_RULES_AUTORUN.md
> How BETK auto-derives the right "agent/skill" so you only choose the model.

## Mechanism
Skills are wired as Cursor **Project Rules** in `.cursor/rules/*.mdc` (repo root). Each rule's frontmatter decides when it loads — no manual @-mention needed:

| Rule | Mode | Fires when |
|---|---|---|
| `00-betk-core.mdc` | Always | every chat/agent turn (baseline: scope freeze, RTL, Zod/RLS, design boundary, model guidance) |
| `10-database.mdc` | Auto (globs) | touching `supabase/migrations/**`, `src/lib/supabase/**`, `**/queries/**` → DB+Supabase skill |
| `20-actions-api.mdc` | Auto (globs) | touching `**/actions/**`, `app/api/**`, `validations/**` → api-architect + zod-validator |
| `30-ui.mdc` | Auto (globs) | touching `components/**`, `app/**/*.tsx` → ui-engineer + design boundary |
| `40-tests.mdc` | Auto (globs) | touching test/spec files → test-engineer |
| `90-review-security.mdc` | Agent-requested | the agent pulls it when the task is a security/merge review |
| `91-review-ui.mdc` | Agent-requested | the agent pulls it when reviewing UI vs the wireframe spec |

The full skill definitions still live in `BETK_AI_SKILLS/skill-*.md`; each rule references its skill so the depth is one hop away while the always-on context stays small.

## What you do per task
1. **Pick the model** (the only manual choice): Opus for DB/migrations, security, architecture, and reviews; Sonnet for UI/actions/tests/wiring.
2. Describe the task (or open/edit the file). The matching rule auto-attaches from the file globs; the core rule is always on.
3. The core rule makes the agent **warn you in one line if your model doesn't match the work** before it proceeds — so even model choice is guided.

That's it — no @-mentioning skills, no copy-pasting role prompts. Confirm a rule is active via Cursor → Settings → Rules (or the chat context panel showing the attached rule).

## Notes
- `.cursor/rules/` is committed to the repo (team-wide). The legacy root `.cursorrules` is deprecated and ignored by Agent mode — `00-betk-core.mdc` supersedes it; `docs/.cursorrules` is kept only as a human-readable summary.
- Keep always-apply rules short; if you add rules, prefer glob or agent-requested modes to protect the context budget.
- Reviews: ask "review this PR for security" / "review this UI against the spec" and the agent requests the matching review rule automatically; run those on Opus.
