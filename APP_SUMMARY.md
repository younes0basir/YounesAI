# Project App Summary

**Last updated:** 2026-08-28
**Status:** Full-stack AI productivity platform — web + Electron desktop + Expo mobile sharing a single Express/PostgreSQL backend

---

## Overview

Desktop-assisted AI productivity dashboard with natural-language multi-agent orchestration. Core value: manage tasks, calendar, reminders, places, projects, files and email through both CRUD UIs and conversational AI, with semantic document retrieval grounding answers in user-owned files and memories.

Clients share one backend:

- **Web frontend** — React 18 + Vite 8 (`frontend/`)
- **Electron desktop shell** — thin `BrowserWindow` that boots the Express backend in the main process (`electron/`) and adds native file dialogs / `chokidar` watching
- **Mobile** — Expo 54 / React Native 0.81 nested git repo under `mobile/` (file-based routing, same API via `EXPO_PUBLIC_API_URL`)

---

## Current Features

| Domain                        | What exists today                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**                      | JWT (7-day, `localStorage` / `expo-secure-store`), `bcryptjs` cost 10, `POST /api/auth/{register,login}` with rate-limiting (`backend/src/routes/auth.js:1`, `backend/src/middleware/auth.js:1`)                                                                                                                                                                     |
| **Tasks**                     | Hierarchy (`parent_task_id`), `details`, `checklist` JSONB with progress, `urgency`/`priority` 1-5, favorite, `ai_priority_score`/`quadrant`, recurrence (`recurrence_rule`, `recurrence_interval`, `next_run_at`), soft delete, assignment (`assigned_to`, `task_assignments`), project link, smart filters (`/api/tasks/smart`) — `frontend/src/pages/Tasks.jsx:1` |
| **Reminders**                 | `trigger_at`, `snoozed_until`, `dismissed_at`, `warn_minutes_before`, recurrence; snooze/dismiss endpoints `POST /api/reminders/:id/{snooze,dismiss}`; warning + due notifications (`backend/src/scheduler/index.js:1`) — `frontend/src/pages/Reminders.jsx:1`                                                                                                       |
| **Calendar / Events**         | `calendar_events` with `starts_at`/`ends_at`, `is_all_day`, `location_text`, `recurrence_rule`, `color`, `metadata` JSONB + `event_attendees` — `frontend/src/pages/Events.jsx:1`                                                                                                                                                                                    |
| **Places & Geofencing**       | `places` (lat/lng double, category, notes, is_visited) + `geofences` (radius, entry/exit) — `frontend/src/pages/Places.jsx:1` with `leaflet`/`react-leaflet`                                                                                                                                                                                                         |
| **Projects & Collaboration**  | `projects`, `project_memberships` (owner/editor/viewer), `task_assignments`, `comments` (threaded, soft-delete), `activity_log`, `entity_links` — `frontend/src/pages/Projects.jsx:1`, `backend/src/routes/api.js:208`                                                                                                                                               |
| **Notifications**             | `notifications` table + in-app `Notifications.jsx:1` and pending alerts `GET /api/alerts/pending` (warning/due). No push/email delivery yet.                                                                                                                                                                                                                         |
| **Global Search**             | `GET /api/search?q=` — keyword ILIKE across tasks/files/places (`backend/src/routes/api.js:52`) + dedicated `frontend/src/pages/Search.jsx:1`                                                                                                                                                                                                                        |
| **File Intelligence**         | Recursive scan, `pdf-parse`/`mammoth` extraction (PDF/DOCX/TXT/CSV), 1500-char chunking (200 overlap), `bge-large-en-v1.5` embeddings (NVIDIA→OpenRouter fallback), `document_embeddings` + `entity_relationships` graph — `frontend/src/pages/Files.jsx:1`, `backend/src/desktop/`                                                                                  |
| **Indexed Folders**           | `indexed_folders` watched via `chokidar`; list/count/recent/statistics via tools `getIndexedFolders`, `getIndexedFolderCount`, `getIndexedFiles`, etc.; cascade delete — `backend/src/routes/api.js:370`                                                                                                                                                             |
| **Semantic Search / RAG**     | Hybrid ILIKE + optional `pgvector` cosine (`VECTOR(1024)` + `ivfflat`) in `memory_embeddings`/`document_embeddings`; `retrieveDocuments`/`retrieveMemory` tools; `retrieval_logs` + `evaluation_logs` with groundedness/hallucination heuristic — `backend/src/retrieval/`                                                                                           |
| **AI Chat**                   | `POST /api/agents/chat` with `sessionId`, `ConversationContext` (in-memory + `conversations.entities` JSONB), `EntityResolver` pronoun binding + `EntityRegistry` + `ResultAggregator` checklist — `frontend/src/pages/Chat.jsx:1`                                                                                                                                   |
| **Multi-Agent Orchestration** | See Agents section below                                                                                                                                                                                                                                                                                                                                             |
| **Image Generation**          | `POST /api/image/generate` → `backend/src/services/imageGenerator.js:1` (NVIDIA FLUX.2 Klein `artifacts[0].base64` → `data:image/png;base64,…`) — `frontend/src/pages/ImageGenerator.jsx:1`                                                                                                                                                                          |
| **Email Intelligence**        | `email_agent` (`backend/src/agents/email/`), Gmail OAuth `googleapis` sync, classification pipeline (`IMPORTANT`/`ACTION_REQUIRED`/`PERSONAL`/`NEWSLETTER`/`PROMOTION`/`SPAM`/`UNKNOWN`), archive/summarize/create-task tools, prompt-guard — `frontend/src/pages/Inbox.jsx:1`, `backend/src/routes/email.js:1`, `backend/db/email.sql:1`                            |
| **Voice**                     | `POST /api/agents/voice/{transcribe,process}` (Groq Whisper, `multer` 25 MB cap) — `frontend/src/pages/Voice.jsx:1`, `backend/src/agents/voiceAgent.js:1`                                                                                                                                                                                                            |
| **Observability**             | `Agents.jsx:1` Control Center + deep-dive analytics (Recharts): success rate, latency, groundedness, graph nodes/edges, retrieval stats, benchmark, cost-per-call. Metrics from `agent_metrics` via `GET /api/agents/metrics/{summary,benchmark,trends}` and `GET /api/monitoring/*`, `GET /api/evaluation/summary` — `backend/src/routes/monitoring.js:1`           |
| **System News**               | `GET /api/news` curated announcements rendered in Agents tab — `backend/src/services/news.js:1`                                                                                                                                                                                                                                                                      |
| **Settings / Users**          | `GET/PUT /api/users/me` (`display_name`) — `frontend/src/pages/Settings.jsx:1`                                                                                                                                                                                                                                                                                       |

---

## Backend — `backend/` (`backend/package.json:1`)

- **Runtime:** Node.js ≥18, Express 4, `pg` raw queries + generic CRUD factory (`backend/src/lib/crud.js:1`)
- **Config:** `dotenv` `.env` (per-agent model/key overrides in `backend/src/agents/config.js:1`)
- **Validation:** `Joi` interceptors on tool calls (`backend/src/tools/_validate.js:1`)
- **File handling:** `multer` to `os.tmpdir()` (Vercel-safe), `chokidar` watcher (`backend/src/desktop/folderWatcher.js:1`)
- **Scheduler:** `node-cron` jobs in `backend/src/scheduler/index.js:1` — reminder warnings (`* * * * *`), reminder delivery (`* * * * *`), task due (`*/15 * * * *`), recurring roll-over (`0 * * * *`), overdue summary (`0 8 * * *`)
- **AI layer:** `backend/src/agents/` (see below) + `fallbackManager` (`backend/src/agents/fallbackManager.js:1`) + `modelClient` (`backend/src/agents/modelClient.js:1` with `response_format` fallback retry)
- **Migrations:** single `backend/db.sql:1` + `backend/src/migrate.js:1` (`npm run migrate`); email supplement `backend/db/email.sql:1` (`npm run migrate:email`)
- **Rate limiting:** `express-rate-limit` per route group; `cors` + body limits
- **Health:** `GET /api/health` (`backend/src/routes/health.js:1`)

### API surface (all auth-gated except login/register/health)

```
POST /api/auth/register, POST /api/auth/login           — backend/src/routes/auth.js:1
POST /api/agents/chat                                     — backend/src/routes/agents.js:32 (sessionId, ConversationContext, entityResolver)
POST /api/agents/{task,event,place,file,gemma}            — direct agent calls
POST /api/agents/memory/{store,search,clear}
POST /api/agents/voice/{transcribe,process}
GET  /api/agents/status, /metrics, /metrics/summary|benchmark|trends
GET|DELETE /api/agents/conversations, DELETE|PATCH /api/agents/conversations/:id
GET  /api/tasks/smart, GET /api/search, POST /api/reminders/:id/{snooze,dismiss}
GET  /api/alerts/pending
POST /api/image/generate, GET /api/news
GET|POST /api/projects, GET|PUT|DELETE /api/projects/:id
GET|PUT /api/users/me, GET /api/activity_log
POST /api/files/{index,register,register-folder}, DELETE /api/files/delete-all
DELETE /api/indexed_folders/:id/cascade
CRUD /api/{devices,tasks,places,calendar_events,reminders,geofences,files,indexed_folders,agent_actions,conversations,ai_memories,notifications,tags,entity_tags,saved_views,comments,project_memberships,task_assignments}
GET  /api/monitoring/{document-index,knowledge-graph,retrieval-stats}  — backend/src/routes/monitoring.js:1
GET  /api/evaluation/{summary,logs}                  — backend/src/routes/evaluation.js:1
GET|POST /api/email/*, POST /api/email/oauth/*     — backend/src/routes/email.js:1
GET  /api/cron/*, GET /api/health
```

---

## Agent System — `backend/src/agents/`

### Agents (11 specialists + orchestrator + voice)

Defined in `backend/src/agents/index.js:20` and `backend/src/agents/capabilities.js:4`:

| Agent          | File                                    | Purpose                                                                                                        | Model (primary)            |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `orchestrator` | `orchestrator.js:18`                    | Intent routing, multi-step plan, final synthesis; fast-path keyword tier, specialist 8B tier, complex 70B tier | Groq `llama-3.3-70b`       |
| `task`         | `taskAgent.js:1`                        | create/update/delete/list tasks + reminders                                                                    | NVIDIA `llama-3.1-8b`      |
| `event`        | `eventAgent.js:1`                       | calendar CRUD, invite/attach, list                                                                             | NVIDIA `llama-3.1-8b`      |
| `place`        | `placeAgent.js:1`                       | location search                                                                                                | NVIDIA `llama-3.1-8b`      |
| `file`         | `fileAgent.js:1`                        | indexed folder/file meta, `retrieveDocuments`                                                                  | NVIDIA `llama-3.1-70b`     |
| `memory`       | `memoryAgent.js:1`                      | store/retrieve semantic memories                                                                               | NVIDIA `bge-large-en-v1.5` |
| `desktop`      | `desktopAgent.js:1`                     | local scan/read/list_folder/open via Tools (no direct `pool`)                                                  | NVIDIA `llama-3.1-8b`      |
| `general`      | `generalAgent.js:1`                     | greetings, identity, fallback chat                                                                             | NVIDIA `llama-3.1-8b`      |
| `gemma`        | `gemmaAgent.js:1`                       | deep reasoning / synthesis                                                                                     | OpenRouter `gemma-4-31b`   |
| `image`        | `imageAgent.js:1`                       | text-to-image via `tools/generateImage`                                                                        | Groq                       |
| `email`        | `email/index.js:1` + `email/agent.js:1` | Gmail list/classify/archive/summarize/create_task                                                              | NVIDIA `llama-3.1-8b`      |
| `project`      | `projectAgent.js:1`                     | create/update/list projects                                                                                    | NVIDIA `llama-3.1-8b`      |
| `voice`        | `voiceAgent.js:1`                       | Whisper transcription + `processRequest` chaining                                                              | Groq Whisper               |

`orchestrator.js:90` implements 3-tier routing: **fast-path** (keyword, no LLM), **specialist** (compact 8B prompt), **complex** (full 70B prompt + multi-intent `plan` with `dependsOn`/`$step:N` binding). Fallback keyword routing covers all agents (`orchestrator.js:388`). Single-agent responses are passed through directly; multi-agent uses `resultAggregator` checklist and LLM synthesis (`orchestrator.js:538`).

`AgentCoordinator.processRequest` (`backend/src/agents/index.js:36`): resolve entities → build `globalContext` (activeTasks, upcomingEvents, memories, documents, etc. via `backend/src/agents/context.js:1`) → orchestrator → `executionPlan.executePlan` sequential/parallel with input binding → `entityRegistry.applyResults` → `resultAggregator` + `formatFinalResponse` → persist `ConversationContext` entities.

### AI Gateway — `backend/src/agents/fallbackManager.js:1`

- `providerPriority` per agent (`fallbackManager.js:14`): most agents `nvidia → groq → openrouter`; `file`/`memory` `nvidia → openrouter`; `image` `groq → openrouter`; `gemma` `openrouter → groq`.
- `generateText(agentType, messages, {temperature, maxTokens, json})` tries providers in order; `generateEmbedding` for memories/documents.
- `getAgentConfig` reads per-agent `apiKey`/`baseUrl`/`model` from `config.js:1` (NVIDIA has per-agent profile).

### Tools — `backend/src/tools/` (`backend/src/tools/index.js:1`)

All DB writes go through tools (Phase-2 freeze: agents never import `pool`). ~34 tools:

```
tasks:   createTask, updateTask, deleteTask, listTasks
events:  createEvent, updateEvent, deleteEvent, listEvents, inviteEventAttendee
places:  createPlace, searchPlaces
projects: createProject, getProject, listProjects, updateProject, deleteProject, linkEntity
files:   searchFiles, retrieveDocuments, listIndexedFiles, fileManagementTools + getIndexedFolders/getIndexedFolderCount/getIndexedFiles/getIndexedDocumentCount/getRecentIndexedFiles/getFolderStatistics
memory:  storeMemory, retrieveMemory
email:   listEmails, classifyEmail, archiveEmail, summarizeEmail, createTaskFromEmail
images:  generateImage
```

Validated via `Joi`, user-scoped (`context.userId`), idempotent on `request_id` (unique partial index).

### Context & Conversation — `backend/src/conversation/`

- `ConversationContext` — hybrid in-memory + `conversations.entities` JSONB, `save/load/toPersistedPayload` (`backend/src/conversation/ConversationContext.js:1`)
- `entityResolver` / `entityRegistry` — pronoun binding (`"it" → currentEvent`) + step-output binding (`backend/src/conversation/entityResolver.js:1`)
- `executionPlan` — parallel/sequential executor with dependency graph (`backend/src/conversation/executionPlan.js:1`)
- `resultAggregator` — checklist + `collectAttachments` for images (`backend/src/conversation/resultAggregator.js:1`)
- `temporalUtility` — `chrono-node` + typo fixes (`mounth→month`) + `N this month` priority (`backend/src/utils/temporalUtility.js:1`)

---

## Frontend — `frontend/` (`frontend/package.json:1`)

- **Stack:** React 18, Vite 8, `@tailwindcss/vite` + Tailwind 4, Zustand (auth `frontend/src/stores/useAuth.js:1`), TanStack Query 5 (server state), Axios (`frontend/src/lib/api.js:1`), Recharts 3, Leaflet + react-leaflet, `framer-motion`, `lucide-react`, `react-hot-toast`, `oxlint`.
- **Routing:** `react-router-dom` 6 (`frontend/src/App.jsx:1`)
- **Pages (17):** `Dashboard.jsx`, `Tasks.jsx`, `Reminders.jsx`, `Events.jsx`, `Places.jsx`, `Projects.jsx`, `Files.jsx`, `Search.jsx`, `Chat.jsx`, `Inbox.jsx` (email), `Voice.jsx`, `ImageGenerator.jsx`, `Agents.jsx` (AI Control Center), `Notifications.jsx`, `Settings.jsx`, `Login.jsx`, `Register.jsx` — all under `frontend/src/pages/*.jsx`
- **Key UX:** `useChat.js` invalidates `['tasks']`/`['events']` on chat success so created items appear without refresh; `control-center/ControlCenter.jsx:1` renders the living agent graph (hover, zoom, Space palette)

---

## Database — `backend/db.sql:1` (PostgreSQL 13+, recommends 14+)

Single idempotent `db.sql` (609 lines) + `db/email.sql`. UUID PKs, `user_id` cascade, `updated_at` trigger, idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, partial unique on `request_id`.

**Core domains (30+ tables):**

| Group         | Tables                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity      | `users`, `devices`                                                                                                                                                                      |
| Productivity  | `tasks` (+ assignment/project/recurrence cols), `calendar_events`, `reminders`, `places`, `geofences`                                                                                   |
| Collaboration | `projects`, `project_memberships`, `task_assignments`, `comments`, `activity_log`, `entity_links`                                                                                       |
| File intel    | `files`, `indexed_folders`, `document_embeddings` (chunk_index/total, summary, entities, word_count, `VECTOR(1024)` + `embedding_json` + `ivfflat`), `entity_relationships`             |
| AI & Memory   | `conversations` (intent, entities, audio_path, archived), `ai_memories`, `memory_embeddings` (`VECTOR(1024)` / JSONB dual)                                                              |
| Observability | `agent_metrics` (provider, model, tokens_used, latency_ms, conversation_id), `evaluation_logs` (groundedness, hallucination_risk, precision/recall), `retrieval_logs`, `scheduled_jobs` |
| Knowledge/UX  | `tags`, `entity_tags`, `saved_views`, `event_attendees`                                                                                                                                 |
| App ops       | `notifications` (types: `task_due`, `task_overdue`, `reminder_warning`, `reminder_due`, `system`), `agent_actions`, `scheduled_jobs`                                                    |

Partial indexes: `idx_tasks_request_id` etc. on `request_id WHERE NOT NULL`; `ivfflat` on vector columns when `pgvector` is present; `idx_tasks_user_status_due`, `idx_notifications_user_read_created`, etc.

---

## File Intelligence Pipeline

```
Desktop folder pick / web upload / web folder import
  → frontend Files.jsx → POST /api/files/{index,register,register-folder}
  → multer → os.tmpdir() → files row
  → desktop/folderWatcher.indexFile → fileReader (PDF/DOCX/TXT/CSV)
  → documentProcessor chunk (1500/200)
  → LLM entity extraction (people/orgs/dates/locations/summary)
  → fallbackManager.generateEmbedding
  → document_embeddings chunk rows (JSONB + VECTOR dual)
  → knowledge/graphBuilder → entity_relationships
  → query via tools.retrieveDocuments / tools.searchFiles (ILIKE + vector cosine)
  → evaluation_logs + retrieval_logs
  → retrieval used in buildContext → LLM grounded answer
```

---

## Desktop — `electron/`

- `main.js` — `require('../backend/src/index.js')` inside Electron main process + `BrowserWindow`; loads Vite dev server or built `dist/`.
- `preload.js` — safe IPC bridge; `ipc/index.js` registers folder dialog, open-file, watch handlers.
- All heavy logic stays in `backend/src/desktop/` so web and desktop share code.

---

## Mobile — `mobile/` (nested git repo)

- Expo 54, Expo Router 6, RN 0.81, TanStack Query, Zustand, Axios, `expo-secure-store`, `expo-notifications`, `react-native-maps`.
- Routes under `mobile/app/`; mirrors web screens (dashboard, tasks, reminders, events, places, files, projects, chat, voice, notifications).
- Drift risk: not tracked by parent repo.

---

## Observability & Evaluation

- `agent_metrics` on every `fallbackManager.generateText` call (`metricsLogger.js:1`); `evaluation_logs` (groundedness, hallucination_risk) and `retrieval_logs` per query.
- Frontend `Agents.jsx:498` Control Center + `AnalyticsSection` / `BenchmarkSection` with bar/radar charts, latency bars, cost analysis (`estimated_cost_usd`, `cost_per_call`).
- `GET /api/agents/metrics/summary` observability endpoint.

---

## Security (current)

- JWT 7-day in `localStorage`; `authMiddleware` on all `/api/*` except auth/health.
- `bcrypt` passwords; per-group `express-rate-limit`.
- `Joi` on tools; user-scoped queries (`user_id` filter); idempotency keys.
- No RBAC, no refresh-token rotation/revocation, no OAuth token encryption, email treated as untrusted data with `email/security/promptGuard.js:1` but no hard prompt-injection sandbox yet.

---

## Deployment (current)

- **Dev:** `npm run dev` in `frontend/` (Vite), `nodemon` in `backend/`, concurrent Electron.
- **DB:** `npm run migrate` (idempotent; no versioned migrations / seeds / reset harness yet).
- **Desktop:** `electron-builder` Windows NSIS.
- **No** staging/prod split, no Docker, no CI/CD, no automated tests (except `tests/conversation.test.js:1`).

---

## Architecture Freeze (Phase 2, 2026-08-10)

```
Frontend → API Routes → Application Services → Orchestrator → Agents → Tools → Services/DB
```

Rules: agents never `require('../db')`; every persistent change validates, authorizes (`context.userId`), handles idempotency, and logs. Verified: `desktopAgent.js` now uses `tools.getIndexedFolders/listIndexedFiles/retrieveDocuments`; `fileAgent.js` uses `tools.retrieveDocuments` (see `docs/ARCHITECTURE.md:359`).

---

## Roadmap (from `plan.md:1` / `docs/ROADMAP.md:1`)

**Stabilize (A):** full audit (`docs/SYSTEM_AUDIT.md:1`), DB hardening/reproducible reset (`db/migrations/`, `db/seeds/`), schema indexes/constraints review, API consistency, agent runtime manifests, run/step state machine (`agent_runs`→`agent_steps`→`tool_calls`→`approvals`).

**Reliable AI (B):** AI Gateway (provider/model routing, retries, timeout, token tracking), structured-output + business-rule verification (`LLM → schema → context → permission → business → execution → verification` per `plan.md:563`), permissions/autonomy (`MANUAL/SEMI_AUTO/AUTO/DISABLED`), approval workflow, evaluation harness (`evals/task,event,file,memory,email,routing,security`).

**Email (C):** Gmail OAuth 2-account sync → normalize → rule engine → classifier → decision → action; `AI Inbox` tabs (Important/Action Required/Personal/Newsletter/Promotion/Spam/Unknown) + explainability + sender learning.

**Automation (D):** event bus (`email.received`, `task.created` …), Scheduler 2.0 (time/email/task/file/calendar/location triggers), unified `notification service` (web/desktop/mobile/Telegram), Daily Briefing (`plan.md:1081`).

**Connectivity (E):** Telegram commands (`/tasks`, `/today`…), device identity + `sync_version` + conflict resolver, PC/laptop agents, mobile parity.

**Intelligence (F):** Memory 2.0 (preferences/people/decisions), better RAG (context planner + budget), long-running workflows.

**Production (G):** security audit (API-key/OAuth encryption, strict isolation, prompt-injection defenses), performance (DB indexes, embedding cache, queues for indexing/AI), 4-layer tests (unit/integration/eval/e2e), 3 envs + health checks, backup/recovery, docs.

---

## Key Documents

- Current architecture deep-dive: `docs/ARCHITECTURE.md:1`
- Target 28-phase plan: `plan.md:1`
- Operational audit: `docs/SYSTEM_AUDIT.md:1` / `docs/KNOWN_BUGS.md:1`
