# Roadmap — Stage 2026

**Date:** 2026-08-13 (updated)  
**Based on:** `plan.md`, `SYSTEM_AUDIT.md`, `KNOWN_BUGS.md`, and `ARCHITECTURE.md`

This roadmap translates the high-level vision from `plan.md` into an executable sequence. The first stages are **non-negotiable stabilization**; later stages add new features only after the foundation is reliable.

---

## Current Status (2026-08-13)

| Stage                            | Progress       | Notes                                                                                |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| Phase 2 — Architecture freeze    | ✅ Complete    | Agent → Tool → Service → DB enforced                                                 |
| Stage 0.5 — Developer experience | ⬜ Not started | Linting, format, CI, pre-commit, Docker Compose, API docs — runs parallel to Stage A |
| Stage A — Stabilize              | 🟡 ~65%        | 🔴 security mostly done; migrations, tests, model consolidation remain               |
| Stage B — Make AI reliable       | ⬜ Not started | AI gateway, eval harness, run state machine                                          |
| Stage C — Email intelligence     | ✅ Complete    | Delivered early (before Stage A exit)                                                |
| Stage D–G                        | ⬜ Not started | Blocked on Stage A + B foundations                                                   |

**Active gate:** Stage A must exit before new feature work. Stage C was an exception; treat its approval pattern as the template for semi-autonomous work in Stage B/D.

---

## Guiding Principles

1. **No new features until Stage A is complete.** The current codebase has real functionality but too many reliability and security gaps to build on safely.
2. **Every change must pass through:** Feature → Domain Model → API/Service → Tool → Permission → Agent → Orchestrator → Verification → Event/Log.
3. **Measure before optimizing.** Add evaluation harnesses early so that refactors can be proven to improve routing/tool/retrieval accuracy.
4. **Security before autonomy.** Semi-autonomous actions (Stage B/D) are only enabled after approval, verification, and audit layers exist.
5. **Two lanes, one platform.** Interactive chat and background workers share tools/services but use different runtimes (see below).

---

## Orchestration Architecture — Dual Lanes

**Decision (2026-08-13):** Do not migrate interactive chat to LangChain. Add semi-autonomous agents later on a separate async runtime with a Postgres audit log chain.

### Lane 1 — Interactive Chat (keep as-is)

User-initiated, synchronous, low-latency. No framework swap planned.

```text
User message
  → OrchestratorAgent (LLM → JSON routing)
  → AgentCoordinator (parallel specialist dispatch)
  → Specialist agents (task, event, email, desktop, …)
  → Tools → Services → Database
  → Response synthesis
```

**Keep:** `orchestrator.js`, `index.js` (coordinator), specialist agents, `fallbackManager`, keyword fallback routing.

**Improve in Stage B (without replacing the pattern):** Zod/Joi validation on routing JSON, AI gateway wrapping provider calls, eval harness for routing accuracy.

**Do not:** Rewrite chat onto LangChain ReAct agents — wrong abstraction for domain-specific JSON-extraction agents.

### Lane 2 — Semi-Autonomous Workers (add in Stage B/D)

System-initiated, async, approval-aware. Runs on triggers (email sync, cron, rules, events).

```text
Trigger (email / schedule / rule / event)
  → Worker runtime (custom state machine or LangGraph — optional)
  → Reuse existing specialist agents + tools (same frozen layers)
  → Approval gate (SEMI_AUTO / MANUAL)
  → Audit log chain (Postgres: agent_runs → agent_steps → tool_calls)
  → Notification / side effect
```

**LangGraph:** Optional adoption for Lane 2 only — checkpointing, pause/resume, human-in-the-loop. Not required for Lane 1 chat.

**Audit log chain (always custom, not from LangChain):** Append-only records in Postgres — `agent_run_started`, `plan_created`, `approval_requested`, `approval_granted`, `tool_executed`, `run_completed`. Source of truth for compliance and debugging.

### Autonomy levels (both lanes)

| Level       | Chat (Lane 1)                     | Workers (Lane 2)                            |
| ----------- | --------------------------------- | ------------------------------------------- |
| `MANUAL`    | User asks; agent suggests only    | Worker proposes; user must approve          |
| `SEMI_AUTO` | —                                 | Worker runs; pauses on batch/risky actions  |
| `AUTO`      | Simple reads (list tasks, search) | Low-risk actions (classify email, log only) |
| `DISABLED`  | —                                 | User turns off category                     |

Email batch approvals (`backend/src/email/approvals.js`) are the first implementation of Lane 2 patterns. Generalize in Stage B.

### Framework policy

| Component                 | Approach                                                      |
| ------------------------- | ------------------------------------------------------------- |
| Chat orchestration        | Custom orchestrator — **no change**                           |
| Specialist agents + tools | Reuse across both lanes                                       |
| Semi-autonomous runtime   | Custom state machine **or** LangGraph (Stage B/D pilot)       |
| Audit / run history       | Postgres tables — **always build ourselves**                  |
| Provider fallback         | AI gateway (Stage B) — wraps existing `fallbackManager` logic |

---

## Architecture Decision Records (ADR)

Major decisions are recorded with their rationale so future contributors understand **why** a decision was made, not just **what** was decided. Records live in `docs/adr/` with full context, decision, and consequences. Adopting this now preserves the reasoning from earlier debates (e.g. the LangChain question) that would otherwise be lost.

| ADR     | Decision                                                                                                                                                                      | Status                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ADR-001 | Keep interactive chat on the custom orchestrator — **do not migrate to LangChain**; build semi-autonomous agents on a separate runtime with a custom Postgres audit log chain | Accepted (2026-08-13) — see "Orchestration Architecture — Dual Lanes" above |
| ADR-002 | pgvector vs. JSONB-only embeddings                                                                                                                                            | **Pending** — resolved by the Stage A database decision                     |

**Convention:** New ADRs follow the classic format — Context, Decision, Positive/negative Consequences, Status. Any change that reverses a prior ADR requires writing a new ADR that supersedes it.

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

| #   | Fix                                                     | Files                                                                                                                                                                          | Notes                                                                                                                                            |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Image generation preview works                          | `backend/src/services/imageGenerator.js`, `frontend/src/pages/ImageGenerator.jsx`                                                                                              | NVIDIA FLUX.2 Klein response (`artifacts[0].base64`) is now parsed into a valid `data:image/png;base64,...` preview; UI shows a live status log. |
| 2   | Fixed double `/api` prefix in frontend monitoring calls | `frontend/src/pages/Agents.jsx`                                                                                                                                                | Monitoring and evaluation calls now use `/monitoring/...` and `/evaluation/...` relative to the Axios baseURL.                                   |
| 3   | Orchestrator knows all specialist agents                | `backend/src/agents/orchestrator.js`, `frontend/src/pages/Agents.jsx`                                                                                                          | System prompt now describes `general`, `desktop`, and `gemma`; dashboard agent list matches.                                                     |
| 4   | Frontend build verified                                 | `frontend/package-lock.json`, full frontend                                                                                                                                    | `npm run build` completed successfully.                                                                                                          |
| 5   | System News feed added                                  | `backend/src/services/news.js`, `backend/src/routes/api.js`, `frontend/src/pages/Agents.jsx`                                                                                   | `GET /api/news` returns curated announcements; Agents dashboard has a System News tab.                                                           |
| 6   | Image Agent added                                       | `backend/src/agents/imageAgent.js`, `backend/src/tools/generateImage.js`, `backend/src/agents/index.js`, `backend/src/agents/orchestrator.js`, `frontend/src/pages/Agents.jsx` | Chat can now route image-generation requests to the `image` agent; dashboard lists it.                                                           |

---

## Stage 0.5 — Developer Experience (Weeks 1–4, in parallel with Stage A)

**Goal:** Remove friction from everyday development so that the quality and speed of every subsequent stage improves. This investment pays off immediately and compounds across all later stages.

| #   | Task                    | Deliverable                                          | Acceptance Criteria                                                                               | Priority |
| --- | ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| 1   | Linting                 | ESLint configs for `backend/` and `frontend/`        | `npm run lint` passes clean; catches errors before review                                         | 🔴       |
| 2   | Formatting              | Prettier config + shared editorconfig                | `npm run format` is deterministic; one style across the repo                                      | 🔴       |
| 3   | CI pipeline             | `.github/workflows/ci.yml`                           | Lint, format check, tests, and build run automatically on every PR                                | 🔴       |
| 4   | Pre-commit hooks        | Husky + lint-staged                                  | Staged commits run lint/format (and tests where fast); non-conforming commits are blocked locally | 🟡       |
| 5   | Dependency updates      | Dependency bot (Dependabot/Renovate) + review policy | Automated PRs for outdated/deprecated packages; regular update cadence                            | 🟡       |
| 6   | Local development setup | Quickstart in `README.md`, `npm run dev`             | Fresh clone → `npm install` → running app in < 10 minutes                                         | 🔴       |
| 7   | Docker Compose          | `docker-compose.yml` (Postgres + backend + frontend) | One command brings up the full stack for local dev and CI                                         | 🟡       |
| 8   | Code generation         | Scaffolding scripts for new agents/tools/routes      | New agent/tool/route is generated with correct wiring automatically                               | 🟢       |
| 9   | API documentation       | OpenAPI spec + browsable docs (Swagger/Redoc)        | Every public endpoint is documented and testable                                                  | 🟢       |

**Stage 0.5 Exit Criteria**

- A fresh clone reaches a working dev server + database without manual steps.
- CI runs lint, format, tests, and build on every PR.
- Contributors never hand-fix formatting or hand-wire new scaffolding.

---

## Stage A — Stabilize (Weeks 1–4)

**Goal:** Make the existing system reproducible, secure, and internally consistent.

**Status:** 🟡 In progress (~65%). Lane 1 chat works; exit criteria not yet met.

| #   | Task                                                             | Deliverable                                                                                     | Acceptance Criteria                                                                                                                | Priority | Status                                                                                                |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Remove real API keys from `.env.example` and rotate exposed keys | `backend/.env.example`                                                                          | All keys are `your_key_here` placeholders; old keys invalidated                                                                    | 🔴       | ✅ Done                                                                                               |
| 2   | Add authentication to unprotected agent endpoints                | `backend/src/routes/agents.js`                                                                  | `/voice/transcribe` and `/agents/status` require `authMiddleware`                                                                  | 🔴       | ✅ Done                                                                                               |
| 3   | Scope projects CRUD by ownership/membership                      | `backend/src/routes/api.js`, auth middleware                                                    | Users can only read/update/delete projects they own or are members of                                                              | 🔴       | ✅ Done                                                                                               |
| 4   | Fix pgvector/schema alignment                                    | `backend/db.sql`, retrieval code                                                                | Either fully enable `VECTOR` columns or remove all `embedding` references and use JSONB consistently                               | 🔴       | 🟡 Partial — `migrate.js` strips VECTOR when unavailable; dual `embedding` + `embedding_json` remains |
| 5   | Introduce versioned migrations                                   | `db/migrations/`, `db/seeds/`, `db/reset/`, migration runner                                    | `npm run migrate` creates a reproducible schema from zero; `npm run seed` populates test data; `npm run db:reset` truncates safely | 🔴       | 🟡 Partial — `npm run migrate` runs `db.sql`; no versioned migrations, seed, or reset                 |
| 6   | Consolidate memory models                                        | `backend/db.sql`, `backend/src/tools/storeMemory.js`, `backend/src/retrieval/retrieveMemory.js` | One canonical memory table; no orphaned `ai_memories` vs `memory_embeddings` split                                                 | 🟡       | ⬜ Open                                                                                               |
| 7   | Consolidate task assignment models                               | `backend/db.sql`, task tools                                                                    | Remove `tasks.assigned_to` or keep it in sync with `task_assignments`                                                              | 🟡       | ⬜ Open                                                                                               |
| 8   | Fix trigger PG 13 compatibility or bump minimum version          | `backend/db.sql`, `backend/README.md`                                                           | Migration succeeds on the documented minimum Postgres version                                                                      | 🟡       | 🟡 Partial — adaptive logic in `migrate.js`                                                           |
| 9   | Add pool configuration and `DATABASE_URL` support                | `backend/src/db.js`                                                                             | Supports SSL, max connections, and connection string for cloud Postgres                                                            | 🟡       | ✅ Done                                                                                               |
| 10  | Add missing FKs and constraints                                  | `backend/db.sql`                                                                                | Polymorphic refs have cleanup logic; document chunk dedup works; parent-task deletion behavior defined                             | 🟡       | ⬜ Open                                                                                               |
| 11  | Remove dead tool exports or wire them                            | `backend/src/tools/index.js`                                                                    | Every exported tool is reachable from an agent or route                                                                            | 🟡       | 🟡 Partial — `createReminder` / `deleteReminder` still unwired                                        |
| 12  | Fix orchestrator action routing                                  | `backend/src/agents/index.js`                                                                   | Coordinator passes `route.action` and `route.parameters` into agents                                                               | 🟡       | ✅ Done                                                                                               |
| 13  | Add memory keywords to fallback routing                          | `backend/src/agents/orchestrator.js`                                                            | "remember" / "what did I tell you" routes to `memory` when LLM fails                                                               | 🟡       | ✅ Done                                                                                               |
| 14  | Fix desktop agent provider priority                              | `backend/src/agents/config.js`, `backend/src/agents/fallbackManager.js`                         | `desktop` has its own provider/model config                                                                                        | 🟡       | ✅ Done                                                                                               |
| 15  | Remove or conditionalize source-check prefix                     | `backend/src/agents/context.js`                                                                 | Agent responses do not leak internal routing unless in debug mode                                                                  | 🟡       | ✅ Done                                                                                               |
| 16  | Add unit/integration tests for critical paths                    | `tests/`                                                                                        | Auth, task CRUD, agent routing, scheduler, file ingestion have passing tests                                                       | 🟡       | 🟡 Partial — `backend/tests/conversation.test.js` covers resolver/plan/registry                       |
| 17  | Update READMEs and documentation                                 | `README.md`, `backend/README.md`                                                                | Table counts, setup steps, and architecture diagrams match reality                                                                 | 🟢       | ⬜ Open                                                                                               |
| 18  | Add missing indexes                                              | `backend/db.sql`                                                                                | `files (user_id, path)`, `conversations (user_id, created_at)`                                                                     | 🟢       | ⬜ Unverified                                                                                         |

**Stage A Exit Criteria**

- `npm run migrate && npm run seed` produces a working dev database from an empty Postgres instance.
- All 🔴 security issues are resolved.
- No agent or route is reachable without authentication unless explicitly public.
- The schema and code agree on how embeddings are stored and queried.
- All exported tools are wired.
- Core tests pass.

---

## Stage A.1 — Unified Conversational Interface (Lane 1)

**Goal:** Chat becomes the universal entry point — multi-turn references, multi-agent plans, inline images, and ProjectAgent — without replacing the custom orchestrator.

**Status:** ✅ Implemented (2026-08-13)

| Component           | Location                                          | Purpose                                                     |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| ConversationContext | `backend/src/conversation/ConversationContext.js` | Session-only active entity tracking (hybrid cache + JSONB)  |
| EntityResolver      | `backend/src/conversation/entityResolver.js`      | Resolve "it/that/the meeting" before orchestrator           |
| Execution plan      | `backend/src/conversation/executionPlan.js`       | Sequential/parallel multi-agent runs with `$step:N` binding |
| Capability registry | `backend/src/agents/capabilities.js`              | Planner uses declared agent actions                         |
| ProjectAgent        | `backend/src/agents/projectAgent.js`              | Project CRUD via tools → services                           |
| Entity links        | `entity_links`, `event_attendees` tables          | Attach files/images; invite attendees                       |
| Chat UX             | `frontend/src/pages/Chat.jsx`                     | Inline images, step checklist, sessionId                    |

**Acceptance conversations:** create meeting → move it; generate logo → make it blue; project + meeting + logo; attach report to task; summarize PDF + store memory.

See [ADR-002](adr/ADR-002-unified-chat-context.md).

---

## Stage B — Make AI Reliable (Weeks 5–8)

**Goal:** Transform the agent layer from a prompt-and-pray system into a measurable, validated, and controllable runtime — **without replacing Lane 1 chat orchestration.**

**Scope split:**

- **Lane 1 (chat):** AI gateway, structured output validation, eval harness for routing — wrap existing orchestrator/agents.
- **Lane 2 (workers):** Run/step state machine, audit log chain, autonomy settings, approval workflow — foundation for semi-autonomous agents in Stage D.

| #   | Task                                           | Deliverable                                                 | Acceptance Criteria                                                                                                                                                                                                       | Priority | Lane   |
| --- | ---------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | Build AI gateway                               | `backend/src/ai/gateway/`                                   | Agents call `ai.generate(...)` not `groq.generate(...)`; gateway handles provider selection, retries, timeout, fallback, rate limiting, structured output, validation, logging, token tracking                            | 🔴       | Both   |
| 2   | Define agent manifests                         | `backend/src/agents/manifests/`                             | Every agent has a manifest with name, version, capabilities, input/output schemas, risk levels, and execution policy                                                                                                      | 🔴       | Both   |
| 3   | Implement run/step state machine               | `backend/src/agents/runtime/`                               | Tables: `agent_runs`, `agent_steps`, `tool_calls`, `tool_results`, `approvals`; states: `CREATED` → `PLANNING` → `EXECUTING` → `WAITING_APPROVAL` → `VERIFYING` → `COMPLETED` / `FAILED` → `RETRY` / `FALLBACK` / `HUMAN` | 🔴       | Lane 2 |
| 4   | Add structured output validation               | `backend/src/ai/schemas/`, `backend/src/tools/_validate.js` | Every LLM response is validated against a Zod/Joi schema before use                                                                                                                                                       | 🔴       | Both   |
| 5   | Add business-rule verification                 | `backend/src/tools/verify/`                                 | After a tool runs, the backend verifies the row exists, the user owns it, and the DB transaction succeeded                                                                                                                | 🔴       | Both   |
| 6   | Implement autonomy settings                    | `backend/src/autonomy/`, frontend settings page             | Every action has a level: `MANUAL`, `SEMI_AUTO`, `AUTO`, `DISABLED`; user can configure per action category                                                                                                               | 🔴       | Lane 2 |
| 7   | Add approval workflow                          | `backend/src/approvals/`, frontend approval UI              | Semi-autonomous actions pause at `WAITING_APPROVAL` and require user Approve/Reject/Review                                                                                                                                | 🔴       | Lane 2 |
| 8   | Build evaluation harness                       | `evals/`                                                    | Datasets for intent, routing, extraction, classification, RAG; metrics tracked: routing accuracy, tool accuracy, parameter accuracy, hallucination rate, fallback rate, latency                                           | 🔴       | Lane 1 |
| 9   | Improve observability dashboard                | `frontend/src/pages/Agents.jsx` + backend routes            | Inspect any failed run; provider health; reliability metrics; token spend                                                                                                                                                 | 🔴       | Both   |
| 10  | Add event bus                                  | `backend/src/events/`                                       | Events emitted: `task.created`, `task.completed`, `reminder.due`, `file.indexed`, `agent.run.failed`, `approval.required`                                                                                                 | 🟡       | Lane 2 |
| 11  | Add input/output validation middleware         | `backend/src/middleware/validation.js`                      | All API inputs are validated; all agent outputs are sanitized                                                                                                                                                             | 🟡       | Both   |
| 12  | Add retry/fallback policies per agent          | `backend/src/ai/gateway/policies/`                          | Configurable retries, timeouts, and fallback providers per capability                                                                                                                                                     | 🟡       | Both   |
| 13  | Pilot LangGraph for one worker flow (optional) | `backend/src/agents/runtime/graphs/`                        | One semi-autonomous flow (e.g. email batch approval or daily briefing) runs on LangGraph or custom FSM; reuses existing tools; logs to audit chain                                                                        | 🟡       | Lane 2 |

**Stage B Exit Criteria**

- No agent code directly calls a provider SDK; all calls go through the gateway.
- Lane 1 chat orchestrator unchanged in behavior; routing validated by eval harness (>80% accuracy target).
- Every semi-autonomous action has a configurable permission level and audit log entry.
- Failed runs can be inspected and replayed (Lane 2).
- Evaluation harness runs automatically and produces a report.
- Hallucination/groundedness metrics are measured and improving.

---

## Stage C — Email Intelligence (Weeks 9–12)

**Status:** Implemented (2026-08-11) — pragmatic delivery with inline approval + security.

**Goal:** Add Gmail integration and an AI-managed inbox.

| #   | Task                                | Deliverable                                          | Status |
| --- | ----------------------------------- | ---------------------------------------------------- | ------ |
| 1   | Gmail OAuth integration             | `backend/src/integrations/gmail/`, frontend settings | Done   |
| 2   | Email sync pipeline                 | `backend/src/integrations/gmail/sync.js`             | Done   |
| 3   | Email data model                    | `backend/db.sql` (9 tables)                          | Done   |
| 4   | Email classification                | `backend/src/agents/emailAgent.js`                   | Done   |
| 5   | Rule engine + AI rules              | `backend/src/email/rules/`                           | Done   |
| 6   | AI Inbox dashboard                  | `frontend/src/pages/Inbox.jsx`                       | Done   |
| 7   | Sender learning                     | `backend/src/email/learning/`                        | Done   |
| 8   | Approval workflow for batch actions | `backend/src/email/approvals.js` + AIStateCard UI    | Done   |
| 9   | Email security hardening            | `backend/src/email/security/`                        | Done   |

See `docs/GMAIL_SETUP.md` for OAuth setup and env vars.

**Stage C Exit Criteria**

- User can connect Gmail and see an AI-classified inbox.
- Batch actions require approval.
- Email content cannot trigger agent actions directly.
- Classification accuracy is measured by the evaluation harness.

---

## Stage D — Automation & Notifications (Weeks 13–16)

**Goal:** Make the assistant proactive via **Lane 2 semi-autonomous workers** (triggers → runtime → tools → approval → notify).

**Prerequisites:** Stage A exit, Stage B (event bus, state machine, audit log), Stage C (email).

| #   | Task                          | Deliverable                                                | Acceptance Criteria                                                                                                         | Priority |
| --- | ----------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Scheduler 2.0 trigger types   | `backend/src/scheduler/triggers/`                          | Triggers: time, email, task, file, calendar, location, system — each enqueues a Lane 2 worker run                           | 🔴       |
| 2   | Notification service          | `backend/src/notifications/`, frontend notification center | Web + desktop + mobile + Telegram unified; priority, expiration, read status, source, device                                | 🔴       |
| 3   | Daily AI briefing worker      | `backend/src/briefing/`, frontend/telegram                 | Every morning: events, tasks, overdue, important emails, top priorities, potential conflicts; logged to audit chain         | 🔴       |
| 4   | Proactive assistant rules     | `backend/src/automation/rules/`                            | Examples: "When university email arrives, classify and notify if important"; "Every Monday 08:00, generate weekly briefing" | 🔴       |
| 5   | Webhook / event subscriptions | `backend/src/events/subscriptions/`                        | External systems can subscribe to platform events                                                                           | 🟡       |
| 6   | Push notification delivery    | integration with web push / desktop notifications          | Notifications reach the right surface at the right time                                                                     | 🟡       |

**Stage D Exit Criteria**

- Lane 2 workers generate notifications and take actions without user prompting (within autonomy settings).
- Daily briefing is accurate and useful; run history inspectable in dashboard.
- Users can create automation rules in the UI.
- All worker actions appear in the audit log chain.

---

## Stage E — Connectivity & Multi-Device (Weeks 17–20)

**Goal:** Add Telegram and device synchronization.

**Prerequisites:** Stage D complete.

| #   | Task                             | Deliverable                                 | Acceptance Criteria                                                                                                           | Priority |
| --- | -------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Telegram bot integration         | `backend/src/integrations/telegram/`        | Commands: `/tasks`, `/today`, `/inbox`, `/briefing`; natural-language processing; approval buttons                            | 🟡       |
| 2   | Device identity first-class      | `backend/db.sql`, auth middleware           | Every action records `user_id`, `device_id`, `source`, `timestamp`                                                            | 🟡       |
| 3   | Sync protocol                    | `backend/src/sync/`                         | `device_id`, `sync_version`, `event_id`, `updated_at` per entity; conflict resolver                                           | 🟡       |
| 4   | Desktop device agent             | `electron/` and `backend/src/desktopAgent/` | Proper device agent with capabilities: filesystem.read/search/watch, notification.send, clipboard, process info               | 🟡       |
| 5   | Mobile app integration           | `mobile/`                                   | Convert nested git repo into a true monorepo package or add a sync workflow; ensure mobile builds against current backend API | 🟡       |
| 6   | Cross-device conflict resolution | `backend/src/sync/conflictResolver.js`      | Last-write-wins is not the default; user is prompted for meaningful conflicts                                                 | 🟡       |

**Stage E Exit Criteria**

- Telegram can be used as a remote control.
- PC and laptop can sync tasks/events/files without overwriting each other.
- Mobile app is integrated into the monorepo or has a documented sync workflow and CI gate.

---

## Stage F — Intelligence & Memory (Weeks 21–24)

**Goal:** Make the assistant learn and reason across domains.

**Prerequisites:** Stage E complete.

| #   | Task                         | Deliverable                       | Acceptance Criteria                                                                                    | Priority |
| --- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Memory 2.0 taxonomy          | `backend/src/memory/`             | Types: preferences, people, projects, decisions, important facts, previous actions, user corrections   | 🟡       |
| 2   | User correction learning     | `backend/src/memory/corrections/` | "Don't archive emails from my university" → stored and applied to future behavior                      | 🟡       |
| 3   | Personal preferences model   | `backend/src/preferences/`        | Learned preferences influence routing, classification, and scheduling                                  | 🟡       |
| 4   | Better RAG                   | `backend/src/retrieval/`          | Hybrid semantic + keyword + graph retrieval; context budget; source ranking                            | 🟡       |
| 5   | Cross-domain reasoning       | `backend/src/reasoning/`          | Assistant can combine task, event, email, file, and memory context to answer complex questions         | 🟡       |
| 6   | Long-running agent workflows | `backend/src/workflows/`          | Multi-step Lane 2 workflows that survive restarts and wait for approvals (LangGraph or custom runtime) | 🟡       |

**Stage F Exit Criteria**

- Assistant remembers explicit user corrections.
- RAG quality is measurably better than Stage B.
- Cross-domain questions are answered accurately.

---

## Stage G — Production (Weeks 25+)

**Goal:** Deploy and operate reliably.

**Prerequisites:** All prior stages complete.

| #   | Task                         | Deliverable                                                          | Acceptance Criteria                                                                               | Priority |
| --- | ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| 1   | Security audit               | `docs/SECURITY_AUDIT.md`                                             | OWASP-style review; API key encryption; OAuth token encryption; strict user isolation; audit logs | 🟡       |
| 2   | Performance optimization     | `backend/src/perf/`                                                  | DB indexes, query optimization, RAG caching, embedding caching, summary caching                   | 🟡       |
| 3   | Queue-based async processing | `backend/src/queue/`                                                 | Email, embeddings, file indexing, AI jobs, notifications processed asynchronously                 | 🟡       |
| 4   | Deployment environments      | `.env.development`, `.env.staging`, `.env.production`, Docker, CI/CD | dev/staging/prod separation; no secrets committed; automated deploys                              | 🟡       |
| 5   | Health checks                | `backend/src/routes/health.js`                                       | health, database health, AI provider health, scheduler health, queue health                       | 🟡       |
| 6   | Backup & recovery            | `ops/backup/`                                                        | Automated DB backups, tested restore procedure                                                    | 🟡       |
| 7   | Monitoring & alerting        | `ops/monitoring/`                                                    | Uptime, error rate, latency, token spend, queue depth alerts                                      | 🟡       |
| 8   | Final documentation          | `docs/`                                                              | Complete, accurate, and up-to-date docs for users, operators, and contributors                    | 🟢       |

**Stage G Exit Criteria**

- System is deployed in production with monitoring and alerting.
- Security audit is clean.
- Disaster recovery is tested.
- Documentation is complete.

---

## Immediate Next Steps (This Week)

Do not proceed past this list until Stage A exit criteria are met.

1. ~~**Security triage:** rotate keys, protect `/voice/transcribe` and `/agents/status`, scope projects CRUD.~~ ✅ Done
2. **Database decision:** choose pgvector vs. JSONB-only and implement the migration.
3. **Migration tooling:** versioned migrations + `npm run seed` + `npm run db:reset`.
4. **Model consolidation:** unify memory (`ai_memories` vs `memory_embeddings`) and task assignment (`assigned_to` vs `task_assignments`).
5. **Wire or remove reminder tools:** `createReminder` / `deleteReminder` in `tools/index.js`.
6. **Test harness:** first integration test for auth → task CRUD → agent chat.

**After Stage A exit — Stage B priority order:**

1. AI gateway + structured output validation (Lane 1 chat reliability)
2. `agent_runs` audit log chain + autonomy settings (Lane 2 foundation)
3. Eval harness for routing accuracy
4. Optional LangGraph pilot on one worker flow (email batch or daily briefing)

---

## Service-Level Objectives (SLOs)

Concrete operational targets that run alongside the feature milestones, so reliability is defined before features are declared complete. Monitoring to feed these numbers lands in Stage G (health checks, monitoring, alerting); data collection for latency/uptime begins as soon as CI has a stable environment.

| Metric              | Target   | Notes                                                      |
| ------------------- | -------- | ---------------------------------------------------------- |
| Chat p95 latency    | < 3 s    | End-to-end interactive lane answer                         |
| Tool success rate   | > 99%    | Successful tool executions / total executions              |
| Worker success rate | > 98%    | Lane 2 runs completing without exhausting retries/fallback |
| Retrieval latency   | < 300 ms | Document/memory retrieval p95                              |
| API uptime          | > 99.9%  | Rolling 30-day window                                      |

**SLO policy:** A stage that adds a new user-facing path must not regress any existing SLO. Metrics are checked against targets once instrumentation exists.

---

## Metrics We Will Track

| Metric                    | Baseline            | Target After Stage A        | Target After Stage B    |
| ------------------------- | ------------------- | --------------------------- | ----------------------- |
| Migration reproducibility | Manual, error-prone | 100% reproducible from zero | 100% reproducible in CI |
| Unauthenticated endpoints | 2+                  | 0                           | 0                       |
| Dead tool exports         | 3                   | 0                           | 0                       |
| Routing accuracy          | Unknown             | Unknown                     | >80% on eval dataset    |
| Tool accuracy             | Unknown             | Unknown                     | >85% on eval dataset    |
| Hallucination rate        | Unknown             | Unknown                     | <10%                    |
| Test coverage             | 0%                  | >30%                        | >60%                    |
| pgvector/schema alignment | Broken              | Fixed                       | Fixed                   |
