# System Audit — Stage 2026

**Date:** 2026-08-10  
**Scope:** Full-stack AI productivity platform (`c:\Users\basir\Documents\hppppppppppp\upf\stage 2026`)  
**Methodology:** Code review, module import tests, schema analysis, and static inspection of key paths.

---

## Executive Summary

The project is a **functionally broad prototype** that already implements most of the major domains described in `AI_PROJECT_SUMMARY.md`: a React web frontend, an Express/PostgreSQL backend, a multi-agent orchestration layer, a document indexing pipeline, and a scheduler. However, it has **not yet crossed the threshold into a reliable, production-ready system**.

The biggest gaps are:

1. **Database schema/code drift** around pgvector embeddings. *(Fixed 2026-08-10)*
2. **No versioned migration or seed system** — only a single idempotent `db.sql` applied manually.
3. **Security gaps** including unauthenticated endpoints and possible real API keys in `.env.example`. *(Fixed 2026-08-10: voice/status endpoints protected, projects scoped, keys removed from example file.)*
4. **Agent runtime lacks structure** — orchestrator actions are now passed through, but autonomy/approval/verification layers do not exist yet.
5. **Isolated mobile app** — a React Native / Expo mobile app exists as a nested git repo, but it is not integrated into the parent repo's build or CI.
6. **Dead/unwired code** — partially addressed; dead tool exports removed, but some agent paths remain direct-endpoint only.

**Overall verdict:** The foundation is real and substantial. Phase 1 audit findings and Phase 2 architecture freeze are complete; the next phase of work remains database stabilization and runtime reliability (Stage A).

---

## Component Status Matrix

| Component | Status | Notes |
|---|---|---|
| Web frontend | Working | React + Vite + Tailwind v4 + React Query; rich UI implemented |
| Backend API | Working | Express routes mount cleanly; graceful shutdown present |
| Authentication | Partial | JWT works; previously unprotected `/voice/transcribe` and `/agents/status` now require auth; no refresh/revocation |
| Database schema | Partial | 28 tables, mostly well-structured; pgvector mismatch |
| Migration system | Poor | Single idempotent SQL file, no versioning, no auto-run |
| Agent coordinator | Working | All agents register and load; routing `action` and `parameters` now passed through |
| Orchestrator | Partial | LLM routing + keyword fallback; memory/image now in fallback; gemma described in prompt |
| Tools layer | Partial | Core tools work; dead exports removed; image generation service added |
| RAG / retrieval | Partial | JSONB fallback works; native vector search is incomplete |
| Scheduler | Working | Cron-based reminder/task/event engines active |
| Desktop (Electron) | Partial | Thin shell loading backend; no package/build verification |
| Mobile app | Present | Nested git repo; Expo/RN app mirrors web screens but is isolated from parent repo |
| Evaluation / metrics | Partial | Tables and logging exist; not exercised as a test suite |
| Documentation | Partial | READMEs exist but are outdated vs. actual code |
| Deployment / DevOps | Poor | No env separation, health checks only basic, no CI |

---

## Frontend Audit

### Stack
- React 18, Vite 8, Tailwind CSS 4, React Query 5, Zustand, Axios, Recharts, Leaflet, date-fns, lucide-react
- Linter: oxlint

### Structure
- `frontend/src/pages/`: Chat, Dashboard, Tasks, Events, Reminders, Places, Files, Projects, Agents, ImageGenerator, Notifications, Search, Voice, Login/Register
- `frontend/src/hooks/`: One hook per domain (tasks, events, reminders, files, chat, agents, etc.)
- `frontend/src/lib/api.js`: Axios instance with `localStorage` token attachment; all API calls use paths relative to the configured base URL (e.g. `/monitoring/...`, `/evaluation/...`) to avoid double `/api` prefixes.
- `frontend/src/stores/useAuth.js`: Zustand auth store

### Findings
- All major UI routes described in `AI_PROJECT_SUMMARY.md` exist in `App.jsx` plus the new `ImageGenerator` page.
- The chat page implements folder scoping, conversation history, and agent-intent badges.
- The `Agents` page is an observability dashboard with charts, metrics, benchmarks, a test sandbox, and a **System News** tab; it now lists all nine specialist agents (`orchestrator`, `task`, `event`, `place`, `file`, `memory`, `general`, `desktop`, `image`, `gemma`).
- API base URL is `/api` (proxy through Vite dev server); no explicit backend URL config in production. The previous `/api/api/...` double-prefix bug in monitoring/evaluation calls has been fixed.
- `ImageGenerator.jsx` displays a live status log during generation and renders the returned `data:image/png;base64,...` preview.
- No global error boundary or retry policy visible in the small sample reviewed.
- Token is stored in `localStorage` (standard, but no refresh/expiration handling beyond login).

**Status:** Working

---

## Backend API Audit

### Stack
- Express 4, PostgreSQL via `pg`, JWT, bcrypt, multer, node-cron, swagger-ui-express
- AI clients: Groq, NVIDIA NIM, OpenRouter (custom wrapper in `backend/src/agents/modelClient.js`)

### Structure
- `backend/src/index.js`: Express bootstrap, routes, scheduler start, graceful shutdown
- `backend/src/routes/`: auth, api (includes `/image/generate`), agents, evaluation, monitoring, health
- `backend/src/lib/crud.js`: Generic CRUD factory
- `backend/src/middleware/`: auth, rateLimiter
- `backend/src/scheduler/`: cron-based engines
- `backend/src/desktop/`: file scanner, watcher, document processor, reader
- `backend/src/retrieval/`: task, event, memory, document, project, conversation retrieval
- `backend/src/knowledge/`: graph builder and queries
- `backend/src/services/`: external API integrations, including `imageGenerator.js` for NVIDIA FLUX.2 Klein

### Findings
- Server starts cleanly and closes the DB pool on SIGTERM/SIGINT.
- Rate limiting is configured for auth, agents, and general API.
- CORS origin is configurable via `CORS_ORIGIN` env var with sensible defaults.
- Body size limit is 1 MB (reasonable for chat, may need tuning for file uploads).
- Image generation route `POST /api/image/generate` is wired to `backend/src/services/imageGenerator.js` and returns a normalized `data:image/png;base64,...` preview.
- System news route `GET /api/news` is wired to `backend/src/services/news.js` and serves the System News tab in the Agents dashboard.
- Swagger UI is mounted but the spec is incomplete vs. the actual API surface.

**Status:** Working

---

## Agents & Orchestrator Audit

### Registered Agents

| Agent | Registered | Orchestrator-aware | Notes |
|---|---|---|---|
| task | Yes | Yes | Uses `createTask`, `updateTask`, `deleteTask`, `listTasks` |
| event | Yes | Yes | Calendar CRUD via tools |
| place | Yes | Yes | Search only; `createPlace` tool is unwired |
| file | Yes | Yes | File metadata, indexed-folder stats, semantic search |
| memory | Yes | Yes | LLM prompt routing; keyword fallback routes to memory |
| general | Yes | Yes | Fallback chat; orchestrator prompt lists it explicitly |
| desktop | Yes | Yes | Local filesystem scan/open/list; orchestrator prompt lists it explicitly |
| image | Yes | Yes | Text-to-image generation via NVIDIA FLUX.2 Klein; orchestrator prompt lists it explicitly |
| gemma | Yes | Yes | Advanced reasoning; orchestrator prompt lists it explicitly |
| voice | No | N/A | Used directly from `/api/agents/voice/*` routes |

### Orchestrator Flow
```
User message
  → Orchestrator LLM (Groq/OpenRouter) returns JSON routing
  → AgentCoordinator runs agents in parallel
  → Temporal parser injects dates if route.needs_parsing
  → Orchestrator.formatFinalResponse synthesizes reply
```

### Issues
- The orchestrator's per-route `action` field (e.g. `getIndexedFolders`) is **never passed to agents**. The coordinator only calls `agent.run(context)`, so agents must re-classify the message themselves. *(Fixed 2026-08-10: `AgentCoordinator.processRequest` now includes `context.action` and `context.parameters`.)*
- The keyword fallback in `orchestrator.getFallbackRouting()` does not route to `memory` or `gemma`. *(Fixed 2026-08-10: memory keywords are now routed; gemma remains a direct endpoint / reasoning route.)*
- `desktopAgent` calls `generateText('general', ...)` instead of a dedicated `desktop` agent type, using the wrong provider priority. *(Fixed 2026-08-10: `desktop` provider priority and config added.)*
- `voiceAgent` is not registered in the coordinator and bypasses the orchestration layer entirely.
- No structured agent runtime with manifests, capabilities, permissions, or execution policies (as required by `plan.md` Phase 5).
- No run/step state machine, approval workflow, or verification layer (Phases 6–9).

The orchestrator's system prompt now explicitly describes all eight specialist agents (`task`, `event`, `place`, `file`, `memory`, `general`, `desktop`, `gemma`) and includes routing examples for each. The frontend `Agents.jsx` dashboard reflects the same agent list.

**Status:** Partial

---

## Tools Layer Audit

### Active Tools
- `createTask`, `updateTask`, `deleteTask`, `listTasks`
- `createEvent`, `updateEvent`, `deleteEvent`
- `searchPlaces`
- `storeMemory`, `retrieveMemory`
- `searchFiles`
- `fileManagementTools` (indexed folder stats, file listing)

### Dead / Unwired Tools
- `createPlace` — exported but no agent calls it
- `createReminder` — exported but no agent calls it
- `deleteReminder` — exported but no agent calls it

### Validation
- `backend/src/tools/_validate.js` has Joi schemas for task, event, reminder, and place.
- Event validation requires `starts_at`/`ends_at`, but the LLM may omit them, leading to potential DB constraint failures.

**Status:** Partial

---

## Database Audit

### Schema Summary
- **28 tables** in a single `backend/db.sql` file (~490 lines).
- Domains: users/devices, tasks, events, reminders, places, geofences, files, projects, comments, activity, conversations, memories, embeddings, metrics, evaluation, retrieval, knowledge graph, scheduler.
- Uses UUID PKs with `gen_random_uuid()` defaults.
- Mostly good foreign-key coverage with CASCADE/SET NULL.
- Well-indexed main query paths.

### Migration System
- **No versioned migration framework** (no Knex, Prisma, Flyway, etc.).
- `npm run migrate` executes `backend/src/migrate.js`, which parses `db.sql` and retries failed statements in multiple passes.
- Migration is **manual** — not run on app startup.
- No `schema_migrations` table, no rollbacks, no seed scripts.

### High-Severity Issues
1. **pgvector columns are commented out but code references them.**
   - `memory_embeddings.embedding` and `document_embeddings.embedding` are `VECTOR(...)` comments.
   - App code inserts/queries `embedding` and the ivfflat index targets it.
   - Runtime falls back to `embedding_json` JSONB + ILIKE; native vector search is broken/incomplete.
2. **Dual memory models:** `ai_memories` (CRUD API) and `memory_embeddings` (agent tools) with no synchronization.
3. **Dual task assignment models:** `tasks.assigned_to` (single) and `task_assignments` (many-to-many) with no consistency constraint.

### Medium-Severity Issues
4. Polymorphic FKs (`notifications.entity_id`, `entity_tags.entity_id`, `entity_relationships.from/to_entity_id`, `scheduled_jobs.entity_id`) have no referential integrity.
5. `document_embeddings` dedup uses `ON CONFLICT DO NOTHING` without a matching UNIQUE constraint.
6. `tasks.parent_task_id` has no `ON DELETE` behavior.
7. `comments` allows both `project_id` and `task_id` to be NULL.
8. Trigger syntax uses `EXECUTE FUNCTION` (PG 14+) while the file header claims PG 13+ support.
9. `agent_metrics.conversation_id` has no FK to `conversations`.
10. `backend/.env.example` may contain real API keys (security risk).

### Low-Severity Issues
11. No GIN full-text index on `document_embeddings.content`.
12. Missing index on `conversations (user_id, created_at)` despite chat-history queries.
13. `warn_minutes_before` added twice in `db.sql`.
14. README says 20 tables / 302 lines; actual is 28 tables / 490 lines.

**Status:** Partial

---

## Scheduler Audit

### Implemented Engines
- Reminder warning engine (every minute)
- Reminder delivery engine (every minute)
- Task-due notifications (every 15 minutes)
- Recurring task engine (hourly)
- Recurring event engine (hourly)
- Overdue task engine (daily at 08:00)

### Implementation
- Uses `node-cron` and direct `pool.query()` SQL.
- Recurrence is limited to `daily`, `weekly`, `monthly` with simple date arithmetic.
- Notifications are written to the `notifications` table; no push/email/Telegram delivery yet.

**Status:** Working

---

## Desktop Audit

### Structure
- `electron/main.js`: Starts the Express backend in the same process, creates the BrowserWindow, loads the Vite dev server or built frontend, initializes folder watchers after 1s.
- `electron/preload.js`: Preload script (contextIsolation enabled, nodeIntegration disabled).
- `electron/ipc/index.js`: IPC handlers for desktop operations.
- `backend/src/desktop/`: fileScanner, folderWatcher, fileReader, documentProcessor.

### Findings
- The desktop layer is a **thin shell** around the web frontend and backend.
- It has real filesystem access: folder selection, recursive scanning, file watching via `chokidar`, text extraction from PDF/DOCX/TXT/CSV, chunking, embeddings, and knowledge-graph node creation.
- Path handling is Windows-centric (`\` separator) in some tools, which may fail on other platforms.

**Status:** Partial

---

## Mobile Audit

### Finding
- A `mobile/` directory **does exist** as a **nested git repository** inside the monorepo.
- It is an Expo / React Native app using Expo Router, TanStack Query, Zustand, and Axios.
- It mirrors the web screens: dashboard, tasks, reminders, events, places, files, projects, chat, voice, notifications.
- Because it is a nested git repo, it is not visible to the parent repo's git status and was missed by top-level searches.

### Issues
- The mobile app is not integrated into the parent repo's build or CI.
- It has its own `.env` and dependency set, which can drift from the web/frontend versions.
- No evidence of recent cross-platform testing or shared component library.

**Status:** Present but isolated

---

## Authentication & Security Audit

### Implemented
- JWT-based auth with 7-day expiry.
- Password hashing with bcrypt.
- Rate limiting on auth and agent routes.
- `authMiddleware` on most `/api` and `/api/agents` routes.

### Gaps
- `POST /api/agents/voice/transcribe` has **no authentication**.
- `GET /api/agents/status` has **no authentication**.
- `/api/auth/me` duplicates JWT logic inline instead of reusing middleware.
- `projects` CRUD lacks ownership scoping (`userScoped: false`), allowing any authenticated user to access any project by ID.
- `backend/.env.example` may contain real provider API keys.
- No refresh token, token revocation, or role-based access control.
- Password minimum length is only 6 characters.

**Status:** Partial

---

## RAG / Retrieval Audit

### Implemented
- Document ingestion: PDF, DOCX, TXT, CSV via `pdf-parse`, `mammoth`, and raw text.
- Chunking with overlap.
- Entity extraction and summary generation via LLM.
- Storage in `document_embeddings` and `files` tables.
- Retrieval uses ILIKE filter + optional vector similarity over candidate paths.
- Retrieval logs and evaluation logs exist.

### Issues
- Vector similarity query casts `embedding_json::text::float[]::vector`, which requires pgvector but the column is JSONB and the schema's `VECTOR` columns are commented out.
- No full-text index; relies on ILIKE.
- Dedup `ON CONFLICT DO NOTHING` is ineffective without a UNIQUE constraint.
- Memory retrieval and document retrieval have duplicated logic.

**Status:** Partial

---

## Evaluation & Metrics Audit

### Implemented
- `agent_metrics` table logs every agent call (latency, provider, model, tokens, success/error).
- `evaluation_logs` table computes groundedness, hallucination risk, and retrieval stats.
- `retrieval_logs` table tracks query/source/result count/latency.
- Routes `/api/evaluation/*` and `/api/monitoring/*` expose summaries and benchmarks.
- Frontend `Agents` page visualizes metrics with Recharts.

### Issues
- Evaluation is passive logging, not an active test suite with expected outputs.
- Groundedness score is a simple word-overlap heuristic, not a rigorous RAGAS metric.
- No evaluation harness or CI integration.

**Status:** Partial

---

## Deployment & DevOps Audit

### Implemented
- Top-level `package.json` wraps frontend dev + Electron dev with `concurrently`.
- Backend has `start`, `dev`, and `migrate` scripts.
- `electron-builder` configuration is present for Windows NSIS packaging.
- Basic health endpoint (`/api/health`) exists.

### Gaps
- No environment separation (`development`/`staging`/`production` env files).
- No CI/CD pipeline or automated tests.
- Database migration is manual and not idempotent across environments.
- No production-ready pool tuning (max connections, SSL, connection timeout).
- No `DATABASE_URL` support; only discrete env vars.
- No backup/recovery, monitoring, or alerting strategy.

**Status:** Poor

---

## Cross-Cutting Concerns

### Code Quality
- Inline `require()` calls appear in hot paths (e.g. `agents/index.js`, `fileAgent.js`, `routes/api.js`).
- `prefixWithSourceCheck` prepends "Source check: ..." to every agent response, which may leak internal routing details to users.
- Several Windows-only assumptions (`exec('start ...')`, backslash path separators).

### Documentation Drift
- `AI_PROJECT_SUMMARY.md` and `backend/README.md` describe a more complete/operational system than the code currently reflects.
- The mobile app is present but isolated as a nested git repo.
- README table counts are outdated.

### Test Coverage
- No test files, unit tests, or integration tests were found.

---

## Recommended Next Steps

1. **Phase 1 audit and Phase 2 architecture freeze are complete.** Continue with Stage A stabilization from `plan.md`.
2. **Fix the database:** add versioned migrations/seeds, consolidate memory models, resolve task assignment dual model, clean up polymorphic FKs.
3. **Add an evaluation harness** before changing agent prompts or routing.
4. **Formalize the agent runtime:** manifests, tool routing, state machine, verification.
5. **Integrate the mobile app:** convert it from a nested git repo into a true monorepo package or add a sync workflow.
6. **Add automated tests** for the critical paths (auth, task CRUD, agent routing, scheduler, image generation).
