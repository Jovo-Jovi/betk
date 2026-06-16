# AI_DEVELOPMENT_RULES.md
> Allowed models, prompting standards, code-review gates.

- **Models:** Opus (latest, currently 4.8) for architecture, ERD/security review, refactoring decisions, and all review gates; Sonnet (latest, 4.6) for daily feature implementation. Using Opus for everything is acceptable but costlier/slower — reserve it for architecture and review to balance budget.
- **Prompting:** always anchor to a doc section ("build X as defined in BETK_UI_SPEC.md §X"). Never "build whatever seems right." Start sessions from the Master Execution Prompt + SESSION_CONTEXT.
- **Review gates (block merge):** Security review (RLS + Zod + auth), UI-reviewer (wireframe compliance + state coverage), QA (AC pass). All on Opus.
- **Scope discipline:** no new pages/tables/features beyond the frozen scope; respect OD-1…OD-6. If blocked, stop and flag — don't improvise schema or invent UI.
- **Credential safety:** never enter or hardcode secrets, payment handles, or service keys in code/logs/URLs; secrets live in Vercel env only.
- **Documentation:** update docs + DEVELOPMENT_JOURNAL after every task.
