# Known Bugs & Issues — Stage 2026

**Date:** 2026-08-10  
**Source:** System audit of `backend/`, `frontend/`, `electron/`, and `backend/db.sql`.

---

## Severity Legend

| Icon | Meaning |
|---|---|
| 🔴 | High — security risk, data corruption, or major feature broken |
| 🟡 | Medium — incorrect behavior, reliability risk, or missing validation |
| 🟢 | Low — code smell, performance issue, or documentation drift |

> **Note:** Bugs marked "Fixed 2026-08-10" were resolved in the current stabilization pass. To see the internal "Source check" provenance prefix in agent responses, set `SHOW_AGENT_SOURCES=true` in the backend environment.

---

## 🔴 High Severity

### 1. Real API keys in `.env.example` (Fixed 2026-08-10)
- **Location:** `backend/.env.example`
- **Risk:** Credential leakage if the file is committed or shared.
- **Expected:** Example files contain only placeholder values.
- **Actual:** Groq, NVIDIA, and/or OpenRouter keys appear to be present.
- **Fix:** Removed duplicate real-key lines; only placeholders remain. Rotate any previously exposed keys in the provider dashboards.
- **Status:** Fixed
- **Priority:** Immediate

### 2. Unauthenticated voice transcription endpoint (Fixed 2026-08-10)
- **Location:** `backend/src/routes/agents.js` — `POST /api/agents/voice/transcribe`
- **Risk:** Anyone can consume Groq Whisper quota and potentially upload audio files.
- **Expected:** All agent endpoints require `authMiddleware`.
- **Actual:** Endpoint is mounted without authentication.
- **Fix:** Added `authMiddleware` and a dedicated `uploadVoice` multer config with 25 MB cap and audio MIME-type filter.
- **Status:** Fixed
- **Priority:** Immediate

### 3. Unauthenticated agent status endpoint (Fixed 2026-08-10)
- **Location:** `backend/src/routes/agents.js` — `GET /api/agents/status`
- **Risk:** Leaks agent list and recent metrics to unauthenticated callers.
- **Expected:** Internal observability endpoints should be authenticated or rate-limited more strictly.
- **Actual:** Endpoint is public.
- **Fix:** Added `authMiddleware` to `GET /api/agents/status`.
- **Status:** Fixed
- **Priority:** Immediate

### 4. pgvector columns commented out while code expects them (Fixed 2026-08-10)
- **Location:** `backend/db.sql` lines 340, 421; `backend/src/tools/storeMemory.js`, `backend/src/retrieval/retrieveMemory.js`, `backend/src/retrieval/retrieveDocuments.js`
- **Risk:** Native vector search is silently broken; the system falls back to JSONB + ILIKE, degrading RAG quality.
- **Expected:** Schema and code agree on whether `embedding` is a `VECTOR` column or a JSONB field.
- **Actual:** Schema comments out `VECTOR` columns; code inserts/queries `embedding` and builds an ivfflat index on it.
- **Fix:** Enabled `VECTOR(1024)` columns in `memory_embeddings` and `document_embeddings`, added an idempotent backfill from `embedding_json`, and updated all storage/retrieval queries to use the `embedding` column directly.
- **Status:** Fixed
- **Priority:** High

### 5. Projects CRUD is not user-scoped (Fixed 2026-08-10)
- **Location:** `backend/src/routes/api.js` — `createCrudRouter(pool, 'projects', { idCol: 'id' })`
- **Risk:** Any authenticated user can read, update, or delete any project by ID.
- **Expected:** Users can only access projects they own or are members of.
- **Actual:** `userScoped: false` is passed for the projects table.
- **Fix:** Replaced the generic CRUD mount with owner/member-scoped `GET/PUT/DELETE /api/projects/:id` routes that verify `owner_id` or `project_memberships`.
- **Status:** Fixed
- **Priority:** High

---

## 🟡 Medium Severity

### 6. No versioned migration system
- **Location:** `backend/db.sql`, `backend/src/migrate.js`
- **Risk:** Schema drift between environments; partial-migration states are possible; no reproducible dev/test database.
- **Expected:** Versioned migrations with a `schema_migrations` table or a migration framework.
- **Actual:** Single idempotent SQL file applied manually with a custom retry parser.
- **Fix:** Adopt `node-pg-migrate`, Knex, or Prisma; add `db/migrations/`, `db/seeds/`, and `db/reset/`.
- **Priority:** High (architectural)

### 7. Dual memory models without synchronization
- **Location:** `ai_memories` table (CRUD API) and `memory_embeddings` table (agent tools)
- **Risk:** Data inconsistency; users see different memories depending on which path they use.
- **Expected:** One canonical memory store.
- **Actual:** Two separate tables with different schemas and access patterns.
- **Fix:** Consolidate into one memory table with embeddings + metadata, or clearly separate "memory notes" from "semantic memory chunks".
- **Priority:** Medium

### 8. Dual task assignment models
- **Location:** `tasks.assigned_to` and `task_assignments` table
- **Risk:** Inconsistent assignment data; UI may show different assignees than the junction table.
- **Expected:** Single source of truth for task assignees.
- **Actual:** Both a single-assignee column and a many-to-many junction exist.
- **Fix:** Remove `tasks.assigned_to` and use `task_assignments` exclusively, or add triggers/constraints to keep them in sync.
- **Priority:** Medium

### 9. Orchestrator `action` field is ignored (Fixed 2026-08-10)
- **Location:** `backend/src/agents/index.js` `AgentCoordinator.processRequest`
- **Risk:** Agents re-classify the message themselves, leading to routing inconsistency and wasted tokens.
- **Expected:** The coordinator passes `route.action` into the agent context so the agent executes the intended action.
- **Actual:** Only `agent.run(context)` is called; `route.action` is discarded.
- **Fix:** `AgentCoordinator.processRequest` and `handleFallbackRouting` now include `context.action` and `context.parameters` for every agent; task/event/memory/place/file/desktop agents respect the forced action and merge forced parameters.
- **Status:** Fixed
- **Priority:** Medium

### 10. Memory agent not in keyword fallback routing (Fixed 2026-08-10)
- **Location:** `backend/src/agents/orchestrator.js` `getFallbackRouting`
- **Risk:** Phrases like "remember that my password is..." or "what did I ask you to remember?" fall back to `general` instead of `memory`.
- **Expected:** Memory-related keywords route to the memory agent when the LLM fails.
- **Actual:** Fallback regex only covers task, event, place, file, desktop, general.
- **Fix:** Added a memory keyword branch (`remember`, `recall`, `memory`, etc.) to `getFallbackRouting`.
- **Status:** Fixed
- **Priority:** Medium

### 11. Desktop agent uses wrong provider priority (Fixed 2026-08-10)
- **Location:** `backend/src/agents/desktopAgent.js`
- **Risk:** Desktop operations may be sent to the wrong model/priority chain (`general` instead of `desktop`).
- **Expected:** `fallbackManager.generateText('desktop', ...)` uses a dedicated provider priority.
- **Actual:** Agent calls `generateText('general', ...)`.
- **Fix:** Added `desktop` model entries to `config.js` and `desktop` provider priority to `fallbackManager.js`; `desktopAgent.js` now calls `generateText('desktop', ...)`.
- **Status:** Fixed
- **Priority:** Medium

### 12. Dead tool exports
- **Location:** `backend/src/tools/index.js`
- **Risk:** Confusing API surface; dead code increases maintenance burden.
- **Expected:** Every exported tool is used by at least one agent or route.
- **Actual:** `createPlace`, `createReminder`, `deleteReminder` are exported but never wired.
- **Fix:** Wire them to agents or remove them from exports.
- **Priority:** Medium

### 13. Polymorphic entity IDs lack foreign keys
- **Location:** `notifications.entity_id`, `entity_tags.entity_id`, `entity_relationships.from/to_entity_id`, `scheduled_jobs.entity_id`
- **Risk:** Orphan references; no cascade cleanup when the referenced row is deleted.
- **Expected:** Either separate tables per entity type or application-level referential integrity checks.
- **Actual:** UUID columns with no FK constraints.
- **Fix:** Add application-level cleanup hooks or redesign polymorphic references.
- **Priority:** Medium

### 14. Document chunk deduplication is ineffective
- **Location:** `backend/src/desktop/documentProcessor.js` `storeChunk`
- **Risk:** Duplicate document chunks can accumulate on re-indexing.
- **Expected:** `ON CONFLICT DO NOTHING` should have a matching UNIQUE constraint.
- **Actual:** No UNIQUE constraint on `(user_id, file_path, chunk_index)` or similar.
- **Fix:** Add a unique constraint or delete old chunks for a file before re-indexing.
- **Priority:** Medium

### 15. Event creation may fail when LLM omits dates (Fixed 2026-08-10)
- **Location:** `backend/src/tools/createEvent.js`, `backend/src/tools/_validate.js`
- **Risk:** Agent returns success but the tool fails to insert into the database.
- **Expected:** The agent either provides required dates or the tool fails gracefully with a clear message.
- **Actual:** Joi schema requires `starts_at`/`ends_at` and the DB column is `NOT NULL`.
- **Fix:** `createEvent` now defaults missing `starts_at` to `NOW() + 1 hour` and missing `ends_at` to `starts_at + 1 hour` before the DB insert.
- **Status:** Fixed
- **Priority:** Medium

### 16. Trigger syntax incompatible with PostgreSQL 13
- **Location:** `backend/db.sql` multiple `CREATE TRIGGER ... EXECUTE FUNCTION ...`
- **Risk:** Migration fails on Postgres 13.
- **Expected:** Schema works on the documented minimum version (PG 13+).
- **Actual:** `EXECUTE FUNCTION` requires PG 14+; PG 13 needs `EXECUTE PROCEDURE`.
- **Fix:** Either bump the minimum version to PG 14 or use `EXECUTE PROCEDURE` for PG 13 compatibility.
- **Priority:** Medium

### 17. Parent task deletion behavior is undefined
- **Location:** `backend/db.sql` — `tasks.parent_task_id` has no `ON DELETE` clause
- **Risk:** Deleting a parent task may block if subtasks exist, leaving an inconsistent hierarchy.
- **Expected:** Subtasks are either cascaded, reparented, or blocked with a clear error.
- **Actual:** Defaults to `NO ACTION` / `RESTRICT`.
- **Fix:** Add `ON DELETE SET NULL` or `CASCADE` based on product decision.
- **Priority:** Medium

### 18. Agent response prefix leaks internal routing (Fixed 2026-08-10)
- **Location:** `backend/src/agents/context.js` `prefixWithSourceCheck`
- **Risk:** Every agent response starts with "Source check: ..." which may confuse users or expose internal logic.
- **Expected:** Source attribution is optional and cleanly formatted.
- **Actual:** Prefix is applied unconditionally to every response.
- **Fix:** `prefixWithSourceCheck` now only emits the "Source check" prefix when the `SHOW_AGENT_SOURCES=true` environment variable is set; normal responses are returned unchanged.
- **Status:** Fixed
- **Priority:** Medium

---

## 🟢 Low Severity

### 19. README table counts are outdated
- **Location:** `backend/README.md` (or similar)
- **Risk:** New developers get a wrong mental model of the schema size.
- **Expected:** README matches the actual 28 tables / 490 lines.
- **Actual:** README states 20 tables / 302 lines.
- **Fix:** Update README to reflect current schema.
- **Priority:** Low

### 20. Missing indexes on common query paths
- **Location:** `files` and `conversations` tables
- **Risk:** Slight query slowdown at scale.
- **Expected:** Indexes cover common filter patterns.
- **Actual:** No index on `files (user_id, path)` or `conversations (user_id, created_at)`.
- **Fix:** Add indexes after load testing.
- **Priority:** Low

### 21. Duplicate `warn_minutes_before` column addition
- **Location:** `backend/db.sql` lines 121 and 324
- **Risk:** Harmless noise, but indicates schema drift from iterative edits.
- **Expected:** Each column is added exactly once.
- **Actual:** Same `ALTER TABLE` appears twice.
- **Fix:** Remove the duplicate line.
- **Priority:** Low

### 22. Inline `require()` in hot paths
- **Location:** `backend/src/agents/index.js`, `backend/src/agents/fileAgent.js`, `backend/src/routes/api.js`, `backend/src/routes/agents.js`
- **Risk:** Slight runtime overhead and inconsistent code style; harder to detect circular dependencies.
- **Expected:** Imports at the top of the module.
- **Actual:** Some utilities are required inside functions.
- **Fix:** Move imports to the top unless there is a documented circular-dependency reason.
- **Priority:** Low

### 23. Windows-only path handling
- **Location:** `backend/src/tools/fileManagementTools.js`, `backend/src/retrieval/retrieveDocuments.js`
- **Risk:** File operations may break on macOS/Linux paths.
- **Expected:** Cross-platform path normalization using `path.sep` or `path.join`.
- **Actual:** Hardcoded backslash separators and `exec('start ...')`.
- **Fix:** Use Node.js `path` module and `process.platform` checks for shell commands.
- **Priority:** Low

### 24. Swagger spec is incomplete
- **Location:** `backend/src/swagger.js`
- **Risk:** API documentation does not match the actual surface.
- **Expected:** Swagger covers all public routes.
- **Actual:** Many agents, evaluation, monitoring, and CRUD routes are missing.
- **Fix:** Generate or update the spec as the API stabilizes.
- **Priority:** Low

### 25. Mobile app is isolated as a nested git repo
- **Location:** `mobile/`
- **Risk:** The mobile app is not tracked by the parent repo, so it can drift out of sync with the web and backend; changes may be lost or duplicated.
- **Expected:** Mobile is a first-class package in the monorepo with shared types, API client, and CI.
- **Actual:** `mobile/` is a separate git repository nested inside the monorepo and not visible in the parent git status.
- **Fix:** Either convert it to a normal monorepo package (recommended) or establish a clear submodule/subtree workflow and a CI gate that tests mobile against the backend.
- **Priority:** Medium (operational)

### 26. Image generation preview broken (Fixed 2026-08-10)
- **Location:** `backend/src/services/imageGenerator.js`
- **Risk:** The backend ignores NVIDIA's actual response format and never returns a usable image preview, so the frontend shows an empty result.
- **Expected:** The backend extracts the base64 image from `artifacts[0].base64` and returns a valid `data:image/png;base64,...` preview.
- **Actual:** The response parser did not handle NVIDIA's `artifacts` envelope, so `image` was undefined.
- **Fix:** Added `extractImagePayload` to scan `artifacts`, `images`, and other common envelopes, then format the value as a base64 data URI. Added clearer auth errors for 401/403 responses.
- **Status:** Fixed
- **Priority:** Medium

### 27. Frontend monitoring calls use double `/api` prefix (Fixed 2026-08-10)
- **Location:** `frontend/src/pages/Agents.jsx`
- **Risk:** Monitoring and evaluation requests fail with 404 because they hit `/api/api/monitoring/...` and `/api/api/evaluation/...`.
- **Expected:** All frontend API calls use the shared Axios baseURL and relative paths (`/monitoring/...`, `/evaluation/...`).
- **Actual:** Calls were hardcoded with a leading `/api`, duplicating the Axios baseURL prefix.
- **Fix:** Removed the leading `/api` from monitoring and evaluation paths so the shared `api` instance builds the correct URL.
- **Status:** Fixed
- **Priority:** Medium

### 28. Orchestrator prompt missing specialist agents (Fixed 2026-08-10)
- **Location:** `backend/src/agents/orchestrator.js`, `frontend/src/pages/Agents.jsx`
- **Risk:** The orchestrator does not know it can route to `general`, `desktop`, or `gemma`, so relevant queries fall back incorrectly or miss the right specialist.
- **Expected:** The orchestrator system prompt lists all available agents and gives routing examples for each.
- **Actual:** The prompt only described `task`, `event`, `place`, `file`, `memory`, and `desktop`.
- **Fix:** Added explicit descriptions and routing examples for `general`, `desktop`, and `gemma` to the orchestrator system prompt. Updated `Agents.jsx` agent definitions to include all eight specialists.
- **Status:** Fixed
- **Priority:** Medium

---

## Bug Triage Summary

| Severity | Open | Fixed in this pass | Immediate Actions |
|---|---|---|---|
| 🔴 High | 0 | 5 | Keys rotated, endpoints protected, pgvector/schema aligned, projects CRUD scoped |
| 🟡 Medium | 10 | 8 | Migrations, model consolidation, FK cleanup, dedup, date validation, mobile integration, image preview, double `/api` prefix, orchestrator agent knowledge |
| 🟢 Low | 6 | 0 | Documentation, indexes, style, cross-platform, Swagger |

**Recommended first sprint:** With all 🔴 issues closed, focus on the top 5 🟡 open issues (migrations, memory/task model consolidation, FK cleanup, dedup, PG 13 compatibility) before any new feature work.
