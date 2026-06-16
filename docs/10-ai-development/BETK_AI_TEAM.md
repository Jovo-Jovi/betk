# BETK_AI_TEAM.md
> Step 9 of the BETK Dev OS. Agent → ownership matrix. In Cursor, each "agent" is a role you adopt by loading its skill file(s) as context. Model assignment per Step 7.

| Agent | Owns | Skill file(s) | Model |
|---|---|---|---|
| Product Manager | Scope, PRD, wireframe compliance | (MVP_SCOPE, PRD, UI_SPEC) | Opus |
| Solution Architect | Architecture, ADRs | skill-api-architect | Opus |
| Database Architect | ERD, Supabase schema, RLS, type generation | skill-database-engineer, skill-supabase-engineer | Opus (review) / Sonnet (impl) |
| Security Engineer | Auth, RLS audit, Zod coverage | skill-security-reviewer, skill-zod-validator | Opus |
| Backend Engineer | API routes, Server Actions, service integrations | skill-api-architect, skill-nextjs-engineer, skill-supabase-engineer | Sonnet |
| Frontend Engineer | UI, components, wireframe-to-code fidelity | skill-ui-engineer | Sonnet |
| UI Reviewer | Wireframe compliance, UI state coverage | skill-ui-reviewer | Opus |
| QA Engineer | Testing, acceptance-criteria validation | skill-test-engineer | Sonnet (write) / Opus (review) |
| Documentation Engineer | Doc updates after every task | (all) | Sonnet |

Review gate: no feature merges without a Security + UI-reviewer + QA pass (Opus for the reviews).
