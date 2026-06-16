# BETK_CURSOR_SETUP.md
> Step 6 of the BETK Dev OS.

- Cursor Pro (Claude access, higher limits, background agents).
- `.cursorrules` (repo root) points every session at the Master Execution Prompt + SESSION_CONTEXT and the doc tree.
- Project context files Claude auto-reads each session: `docs/10-ai-development/BETK_MASTER_EXECUTION_PROMPT.md`, `SESSION_CONTEXT.md`, the relevant `BETK_AI_SKILLS/skill-*.md` for the task, and the page section in `BETK_UI_SPEC.md`.
- Model strategy (Step 7): Opus 4.8 for architecture/review/security; Sonnet 4.6 for implementation. You drive dev in Cursor with Opus and use the Claude.ai chat to generate prompts + review outputs across phases — keep that loop anchored to SESSION_CONTEXT so neither surface relies on conversation memory.
