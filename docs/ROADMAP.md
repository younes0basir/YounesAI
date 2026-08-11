# Roadmap — Stage 2026

**Date:** 2026-08-10  
**Based on:** `plan.md`, `SYSTEM_AUDIT.md`, `KNOWN_BUGS.md`, and `ARCHITECTURE.md`

This roadmap translates the high-level vision from `plan.md` into an executable sequence. The first stages are **non-negotiable stabilization**; later stages add new features only after the foundation is reliable.

---

## Guiding Principles

1. **No new features until Stage A is complete.** The current codebase has real functionality but too many reliability and security gaps to build on safely.
2. **Every change must pass through:** Feature → Domain Model → API/Service → Tool → Permission → Agent → Orchestrator → Verification → Event/Log.
3. **Measure before optimizing.** Add evaluation harnesses early so that refactors can be proven to improve routing/tool/retrieval accuracy.
4. **Security before autonomy.** Autonomous actions (Stage C/D) are only enabled after approval, verification, and audit layers exist.

---

## Phase 2 — Architecture Freeze (Complete)

**Date:** 2026-08-10

The layer contract from `plan.md` is now enforced:

```text
Agent
 ↓
Tool
 ↓
Service
 ↓
Database
```

- `desktopAgent.js` no longer imports `pool` or executes raw SQL.
- New tools `retrieveDocuments` and `listIndexedFiles` wrap database access.
- Dead tool exports (`createReminder`, `deleteReminder`, `createPlace`) were removed from `tools/index.js`.
- Inline `require` calls in `fileAgent.js` and `voiceAgent.js` were moved to the top of each module.

See `ARCHITECTURE.md` → "Frozen Architecture — Phase 2" for the full contract and tool surface.

---

## Recent Fixes Log (2026-08-10)

These fixes were verified and merged after the initial audit.

| # | Fix | Files | Notes |
|---|---|---|---|
| 1 | Image generation preview works | `backend/src/services/imageGenerator.js`, `frontend/src/pages/ImageGenerator.jsx` | NVIDIA FLUX.2 Klein response (`artifacts[0].base64`) is now parsed into a valid `data:image/png;base64,...` preview; UI shows a live status log. |
| 2 | Fixed double `/api` prefix in frontend monitoring calls | `frontend/src/pages/Agents.jsx` | Monitoring and evaluation calls now use `/monitoring/...` and `/evaluation/...` relative to the Axios baseURL. |
| 3 | Orchestrator knows all specialist agents | `backend/src/agents/orchestrator.js`, `frontend/src/pages/Agents.jsx` | System prompt now describes `general`, `desktop`, and `gemma`; dashboard agent list matches. |
| 4 | Frontend build verified | `frontend/package-lock.json`, full frontend | `npm run build` completed successfully. |
| 5 | System News feed added | `backend/src/services/news.js`, `backend/src/routes/api.js`, `frontend/src/pages/Agents.jsx` | `GET /api/news` returns curated announcements; Agents dashboard has a System News tab. |
| 6 | Image Agent added | `backend/src/agents/imageAgent.js`, `backend/src/tools/generateImage.js`, `backend/src/agents/index.js`, `backend/src/agents/orchestrator.js`, `frontend/src/pages/Agents.jsx` | Chat can now route image-generation requests to the `image` agent; dashboard lists it. |

---

## Stage A — Stabilize (Weeks 1–4)

**Goal:** Make the existing system reproducible, secure, and internally consistent.

| # | Task | Deliverable | Acceptance Criteria | Priority |
|---|---|---|---|---|
| 1 | Remove real API keys from `.env.example` and rotate exposed keys | `backend/.env.example` | All keys are `your_key_here` placeholders; old keys invalidated | 🔴 |
| 2 | Add authentication to unprotected agent endpoints | `backend/src/routes/agents.js` | `/voice/transcribe` and `/agents/status` require `authMiddleware` | 🔴 |
| 3 | Scope projects CRUD by ownership/membership | `backend/src/routes/api.js`, auth middleware | Users can only read/update/delete projects they own or are members of | 🔴 |
| 4 | Fix pgvector/schema alignment | `backend/db.sql`, retrieval code | Either fully enable `VECTOR` columns or remove all `embedding` references and use JSONB consistently | 🔴 |
| 5 | Introduce versioned migrations | `db/migrations/`, `db/seeds/`, `db/reset/`, migration runner | `npm run migrate` creates a reproducible schema from zero; `npm run seed` populates test data; `npm run db:reset` truncates safely | 🔴 |
| 6 | Consolidate memory models | `backend/db.sql`, `backend/src/tools/storeMemory.js`, `backend/src/retrieval/retrieveMemory.js` | One canonical memory table; no orphaned `ai_memories` vs `memory_embeddings` split | 🟡 |
| 7 | Consolidate task assignment models | `backend/db.sql`, task tools | Remove `tasks.assigned_to` or keep it in sync with `task_assignments` | 🟡 |
| 8 | Fix trigger PG 13 compatibility or bump minimum version | `backend/db.sql`, `backend/README.md` | Migration succeeds on the documented minimum Postgres version | 🟡 |
| 9 | Add pool configuration and `DATABASE_URL` support | `backend/src/db.js` | Supports SSL, max connections, and connection string for cloud Postgres | 🟡 |
| 10 | Add missing FKs and constraints | `backend/db.sql` | Polymorphic refs have cleanup logic; document chunk dedup works; parent-task deletion behavior defined | 🟡 |
| 11 | Remove dead tool exports or wire them | `backend/src/tools/index.js` | Every exported tool is reachable from an agent or route | 🟡 |
| 12 | Fix orchestrator action routing | `backend/src/agents/index.js` | Coordinator passes `route.action` and `route.parameters` into agents | 🟡 |
| 13 | Add memory keywords to fallback routing | `backend/src/agents/orchestrator.js` | "remember" / "what did I tell you" routes to `memory` when LLM fails | 🟡 |
| 14 | Fix desktop agent provider priority | `backend/src/agents/config.js`, `backend/src/agents/fallbackManager.js` | `desktop` has its own provider/model config | 🟡 |
| 15 | Remove or conditionalize source-check prefix | `backend/src/agents/context.js` | Agent responses do not leak internal routing unless in debug mode | 🟡 |
| 16 | Add unit/integration tests for critical paths | `tests/` | Auth, task CRUD, agent routing, scheduler, file ingestion have passing tests | 🟡 |
| 17 | Update READMEs and documentation | `README.md`, `backend/README.md` | Table counts, setup steps, and architecture diagrams match reality | 🟢 |
| 18 | Add missing indexes | `backend/db.sql` | `files (user_id, path)`, `conversations (user_id, created_at)` | 🟢 |

**Stage A Exit Criteria**
- `npm run migrate && npm run seed` produces a working dev database from an empty Postgres instance.
- All 🔴 security issues are resolved.
- No agent or route is reachable without authentication unless explicitly public.
- The schema and code agree on how embeddings are stored and queried.
- All exported tools are wired.
- Core tests pass.

---

## Stage B — Make AI Reliable (Weeks 5–8)

**Goal:** Transform the agent layer from a prompt-and-pray system into a measurable, validated, and controllable runtime.

| # | Task | Deliverable | Acceptance Criteria | Priority |
|---|---|---|---|---|
| 1 | Build AI gateway | `backend/src/ai/gateway/` | Agents call `ai.generate(...)` not `groq.generate(...)`; gateway handles provider selection, retries, timeout, fallback, rate limiting, structured output, validation, logging, token tracking | 🔴 |
| 2 | Define agent manifests | `backend/src/agents/manifests/` | Every agent has a manifest with name, version, capabilities, input/output schemas, risk levels, and execution policy | 🔴 |
| 3 | Implement run/step state machine | `backend/src/agents/runtime/` | Tables: `agent_runs`, `agent_steps`, `tool_calls`, `tool_results`, `approvals`; states: `CREATED` → `PLANNING` → `EXECUTING` → `WAITING_APPROVAL` → `VERIFYING` → `COMPLETED` / `FAILED` → `RETRY` / `FALLBACK` / `HUMAN` | 🔴 |
| 4 | Add structured output validation | `backend/src/ai/schemas/`, `backend/src/tools/_validate.js` | Every LLM response is validated against a Zod/Joi schema before use | 🔴 |
| 5 | Add business-rule verification | `backend/src/tools/verify/` | After a tool runs, the backend verifies the row exists, the user owns it, and the DB transaction succeeded | 🔴 |
| 6 | Implement autonomy settings | `backend/src/autonomy/`, frontend settings page | Every action has a level: `MANUAL`, `SEMI_AUTO`, `AUTO`, `DISABLED`; user can configure per action category | 🔴 |
| 7 | Add approval workflow | `backend/src/approvals/`, frontend approval UI | Semi-autonomous actions pause at `WAITING_APPROVAL` and require user Approve/Reject/Review | 🔴 |
| 8 | Build evaluation harness | `evals/` | Datasets for intent, routing, extraction, classification, RAG; metrics tracked: routing accuracy, tool accuracy, parameter accuracy, hallucination rate, fallback rate, latency | 🔴 |
| 9 | Improve observability dashboard | `frontend/src/pages/Agents.jsx` + backend routes | Inspect any failed run; provider health; reliability metrics; token spend | 🔴 |
| 10 | Add event bus | `backend/src/events/` | Events emitted: `task.created`, `task.completed`, `reminder.due`, `file.indexed`, `agent.run.failed`, `approval.required` | 🟡 |
| 11 | Add input/output validation middleware | `backend/src/middleware/validation.js` | All API inputs are validated; all agent outputs are sanitized | 🟡 |
| 12 | Add retry/fallback policies per agent | `backend/src/ai/gateway/policies/` | Configurable retries, timeouts, and fallback providers per capability | 🟡 |

**Stage B Exit Criteria**
- No agent code directly calls a provider SDK; all calls go through the gateway.
- Every autonomous action has a configurable permission level.
- Failed runs can be inspected and replayed.
- Evaluation harness runs automatically and produces a report.
- Hallucination/groundedness metrics are measured and improving.

---

## Stage C — Email Intelligence (Weeks 9–12)

**Status:** Implemented (2026-08-11) — pragmatic delivery with inline approval + security.

**Goal:** Add Gmail integration and an AI-managed inbox.

| # | Task | Deliverable | Status |
|---|---|---|---|
| 1 | Gmail OAuth integration | `backend/src/integrations/gmail/`, frontend settings | Done |
| 2 | Email sync pipeline | `backend/src/integrations/gmail/sync.js` | Done |
| 3 | Email data model | `backend/db.sql` (9 tables) | Done |
| 4 | Email classification | `backend/src/agents/emailAgent.js` | Done |
| 5 | Rule engine + AI rules | `backend/src/email/rules/` | Done |
| 6 | AI Inbox dashboard | `frontend/src/pages/Inbox.jsx` | Done |
| 7 | Sender learning | `backend/src/email/learning/` | Done |
| 8 | Approval workflow for batch actions | `backend/src/email/approvals.js` + AIStateCard UI | Done |
| 9 | Email security hardening | `backend/src/email/security/` | Done |

See `docs/GMAIL_SETUP.md` for OAuth setup and env vars.

**Stage C Exit Criteria**
- User can connect Gmail and see an AI-classified inbox.
- Batch actions require approval.
- Email content cannot trigger agent actions directly.
- Classification accuracy is measured by the evaluation harness.

---

## Stage D — Automation & Notifications (Weeks 13–16)

**Goal:** Make the assistant proactive.

**Prerequisites:** Stage B (event bus, state machine) and Stage C (email) complete.

| # | Task | Deliverable | Acceptance Criteria | Priority |
|---|---|---|---|---|
| 1 | Scheduler 2.0 trigger types | `backend/src/scheduler/triggers/` | Triggers: time, email, task, file, calendar, location, system | 🔴 |
| 2 | Notification service | `backend/src/notifications/`, frontend notification center | Web + desktop + mobile + Telegram unified; priority, expiration, read status, source, device | 🔴 |
| 3 | Daily AI briefing | `backend/src/briefing/`, frontend/telegram | Every morning: events, tasks, overdue, important emails, top priorities, potential conflicts | 🔴 |
| 4 | Proactive assistant rules | `backend/src/automation/rules/` | Examples: "When university email arrives, classify and notify if important"; "Every Monday 08:00, generate weekly briefing" | 🔴 |
| 5 | Webhook / event subscriptions | `backend/src/events/subscriptions/` | External systems can subscribe to platform events | 🟡 |
| 6 | Push notification delivery | integration with web push / desktop notifications | Notifications reach the right surface at the right time | 🟡 |

**Stage D Exit Criteria**
- The system generates notifications without user prompting.
- Daily briefing is accurate and useful.
- Users can create automation rules in the UI.

---

## Stage E — Connectivity & Multi-Device (Weeks 17–20)

**Goal:** Add Telegram and device synchronization.

**Prerequisites:** Stage D complete.

| # | Task | Deliverable | Acceptance Criteria | Priority |
|---|---|---|---|---|
| 1 | Telegram bot integration | `backend/src/integrations/telegram/` | Commands: `/tasks`, `/today`, `/inbox`, `/briefing`; natural-language processing; approval buttons | 🟡 |
| 2 | Device identity first-class | `backend/db.sql`, auth middleware | Every action records `user_id`, `device_id`, `source`, `timestamp` | 🟡 |
| 3 | Sync protocol | `backend/src/sync/` | `device_id`, `sync_version`, `event_id`, `updated_at` per entity; conflict resolver | 🟡 |
| 4 | Desktop device agent | `electron/` and `backend/src/desktopAgent/` | Proper device agent with capabilities: filesystem.read/search/watch, notification.send, clipboard, process info | 🟡 |
| 5 | Mobile app integration | `mobile/` | Convert nested git repo into a true monorepo package or add a sync workflow; ensure mobile builds against current backend API | 🟡 |
| 6 | Cross-device conflict resolution | `backend/src/sync/conflictResolver.js` | Last-write-wins is not the default; user is prompted for meaningful conflicts | 🟡 |

**Stage E Exit Criteria**
- Telegram can be used as a remote control.
- PC and laptop can sync tasks/events/files without overwriting each other.
- Mobile app is integrated into the monorepo or has a documented sync workflow and CI gate.

---

## Stage F — Intelligence & Memory (Weeks 21–24)

**Goal:** Make the assistant learn and reason across domains.

**Prerequisites:** Stage E complete.

| # | Task | Deliverable | Acceptance Criteria | Priority |
|---|---|---|---|---|
| 1 | Memory 2.0 taxonomy | `backend/src/memory/` | Types: preferences, people, projects, decisions, important facts, previous actions, user corrections | 🟡 |
| 2 | User correction learning | `backend/src/memory/corrections/` | "Don't archive emails from my university" → stored and applied to future behavior | 🟡 |
| 3 | Personal preferences model | `backend/src/preferences/` | Learned preferences influence routing, classification, and scheduling | 🟡 |
| 4 | Better RAG | `backend/src/retrieval/` | Hybrid semantic + keyword + graph retrieval; context budget; source ranking | 🟡 |
| 5 | Cross-domain reasoning | `backend/src/reasoning/` | Assistant can combine task, event, email, file, and memory context to answer complex questions | 🟡 |
| 6 | Long-running agent workflows | `backend/src/workflows/` | Multi-step workflows that survive restarts and wait for approvals | 🟡 |

**Stage F Exit Criteria**
- Assistant remembers explicit user corrections.
- RAG quality is measurably better than Stage B.
- Cross-domain questions are answered accurately.

---

## Stage G — Production (Weeks 25+)

**Goal:** Deploy and operate reliably.

**Prerequisites:** All prior stages complete.

| # | Task | Deliverable | Acceptance Criteria | Priority |
|---|---|---|---|---|
| 1 | Security audit | `docs/SECURITY_AUDIT.md` | OWASP-style review; API key encryption; OAuth token encryption; strict user isolation; audit logs | 🟡 |
| 2 | Performance optimization | `backend/src/perf/` | DB indexes, query optimization, RAG caching, embedding caching, summary caching | 🟡 |
| 3 | Queue-based async processing | `backend/src/queue/` | Email, embeddings, file indexing, AI jobs, notifications processed asynchronously | 🟡 |
| 4 | Deployment environments | `.env.development`, `.env.staging`, `.env.production`, Docker, CI/CD | dev/staging/prod separation; no secrets committed; automated deploys | 🟡 |
| 5 | Health checks | `backend/src/routes/health.js` | health, database health, AI provider health, scheduler health, queue health | 🟡 |
| 6 | Backup & recovery | `ops/backup/` | Automated DB backups, tested restore procedure | 🟡 |
| 7 | Monitoring & alerting | `ops/monitoring/` | Uptime, error rate, latency, token spend, queue depth alerts | 🟡 |
| 8 | Final documentation | `docs/` | Complete, accurate, and up-to-date docs for users, operators, and contributors | 🟢 |

**Stage G Exit Criteria**
- System is deployed in production with monitoring and alerting.
- Security audit is clean.
- Disaster recovery is tested.
- Documentation is complete.

---

## Immediate Next Steps (This Week)

Do not proceed past this list until it is complete.

1. **Security triage:** rotate keys, protect `/voice/transcribe` and `/agents/status`, scope projects CRUD.
2. **Database decision:** choose pgvector vs. JSONB-only and implement the migration.
3. **Migration tooling:** adopt a migration framework and create the first migration/seed/reset scripts.
4. **Model consolidation:** unify memory and task assignment models.
5. **Test harness:** add the first integration test for auth → task CRUD → agent chat.

---

## Metrics We Will Track

| Metric | Baseline | Target After Stage A | Target After Stage B |
|---|---|---|---|
| Migration reproducibility | Manual, error-prone | 100% reproducible from zero | 100% reproducible in CI |
| Unauthenticated endpoints | 2+ | 0 | 0 |
| Dead tool exports | 3 | 0 | 0 |
| Routing accuracy | Unknown | Unknown | >80% on eval dataset |
| Tool accuracy | Unknown | Unknown | >85% on eval dataset |
| Hallucination rate | Unknown | Unknown | <10% |
| Test coverage | 0% | >30% | >60% |
| pgvector/schema alignment | Broken | Fixed | Fixed |
