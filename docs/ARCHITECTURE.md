# Architecture — Stage 2026

**Date:** 2026-08-10  
**Scope:** Current architecture of the full-stack AI productivity platform.

---

## High-Level Overview

The system is a **personal AI productivity assistant** with four claimed interfaces (web, desktop, mobile, Telegram in the future) sharing a single Express/PostgreSQL backend. Today, the codebase contains the **web frontend**, the **backend API**, a thin **Electron desktop shell**, and a **React Native / Expo mobile app** as a nested git repository.

The core value proposition is natural-language task/event/place/file/memory management, combined with semantic document retrieval and proactive scheduling.

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web App   │  │  Desktop    │  │   Mobile    │         │
│  │  (React)    │  │  (Electron) │  │ (Expo/RN)   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                             │
│  Express + JWT auth + rate limiting + CORS + body limits      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      ROUTE LAYER                               │
│  /api/auth  /api/*  /api/agents  /api/evaluation  /api/monitoring│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           CONVERSATIONAL ORCHESTRATION LAYER (Lane 1)          │
│  ConversationContext (session) → EntityResolver → Planner      │
│  Hybrid store: in-memory cache + conversations.entities JSONB  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 ORCHESTRATION LAYER                          │
│  AgentCoordinator  →  Orchestrator LLM  →  Temporal Parser   │
│  executePlan (sequential/parallel)  →  ResultAggregator        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      AGENT LAYER                             │
│  task  event  place  file  memory  general  desktop  image   │
│  gemma  email  project                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      TOOLS LAYER                             │
│  createTask  createEvent  searchPlaces  storeMemory          │
│  searchFiles  fileManagementTools  retrieveDocuments         │
│  generateImage  ...                                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE / DATA LAYER                     │
│  Generic CRUD factory  +  direct SQL  +  PostgreSQL           │
│  External service integrations (NVIDIA image generation)     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL PROVIDERS                         │
│  Groq  ·  NVIDIA NIM  ·  OpenRouter  ·  (future: Gmail)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

- **Framework:** React 18
- **Build tool:** Vite 8
- **Styling:** Tailwind CSS 4 + `@tailwindcss/vite`
- **State management:** Zustand (auth), React Query (server state)
- **HTTP:** Axios
- **Charts:** Recharts
- **Maps:** Leaflet + react-leaflet
- **Linting:** oxlint

### Backend

- **Runtime:** Node.js
- **Framework:** Express 4
- **Database:** PostgreSQL 13+ (实际 requires 14+ due to trigger syntax)
- **ORM / query builder:** None (raw `pg` queries + generic CRUD factory)
- **Migration:** Custom `migrate.js` over a single `db.sql`
- **Scheduler:** `node-cron`
- **File parsing:** `pdf-parse`, `mammoth`
- **File watching:** `chokidar`
- **Validation:** Joi
- **Auth:** JWT + bcryptjs

### Desktop

- **Shell:** Electron 30
- **Packaging:** electron-builder (Windows NSIS target)
- **Process model:** Backend is required inside the Electron main process

### AI Providers

- **Groq:** orchestrator, task, event, place, general, whisper
- **NVIDIA NIM:** file analysis, memory embeddings, image generation (FLUX.2 Klein via `backend/src/services/imageGenerator.js`)
- **OpenRouter:** fallback for all; dedicated Gemma model

---

## Request Flow

### Chat Request Example

```text
User types: "Create a meeting tomorrow at 3pm called AI Demo"

1. Frontend sends POST /api/agents/chat { message, sessionId }
2. authMiddleware validates JWT, extracts userId
3. buildContext() enriches request with user profile, tasks, events, documents
4. ConversationContext.load(userId, sessionId) — hybrid cache + entities JSONB recovery
5. EntityResolver.resolve(message, session) — binds pronouns ("it", "that meeting") to IDs
6. User message inserted into conversations
7. AgentCoordinator.processRequest() called with resolved context
8. Orchestrator returns routing plan or agent list (tiered 8B/70B)
9. executePlan runs agents (parallel or sequential with $step:N input binding)
10. EntityRegistry updates session state from tool results
11. ResultAggregator builds checklist for multi-step responses
12. Assistant response + entities JSONB persisted (includes image attachments)
13. Response returned to frontend — Chat.jsx renders text, steps, inline images
```

### Conversational follow-up example

```text
User: "Move it to Friday"

1. EntityResolver binds "it" → currentEvent from ConversationContext
2. Orchestrator routes to event agent with eventId pre-filled
3. EventAgent calls tools.updateEvent — no re-identification needed
4. Session state updated; user sees "✓ Meeting updated"
```

### Direct Agent Request Example

```text
POST /api/agents/task { message: "list my tasks" }

1. authMiddleware
2. context.message is set
3. agentCoordinator.callAgent('task', 'run', context)
4. TaskAgent.run() processes the message
5. TaskAgent calls tools.listTasks(context)
6. Result returned to frontend
```

### Image Generation Request Example

```text
POST /api/image/generate { prompt, width, height, steps, seed }

1. authMiddleware
2. backend/src/services/imageGenerator.js calls NVIDIA FLUX.2 Klein endpoint
3. Response payload is normalized from artifacts[0].base64 into data:image/png;base64,...
4. Image metadata + base64 preview returned to frontend
5. ImageGenerator.jsx renders the preview and shows a status log
```

### System News Request Example

```text
GET /api/news?limit=10

1. authMiddleware
2. backend/src/services/news.js returns curated system announcements
3. Agents.jsx renders the System News tab with categorized cards
```

---

## Database Design

### Core Domains

1. **Identity & Sync:** `users`, `devices`
2. **Productivity:** `tasks`, `calendar_events`, `reminders`, `places`, `geofences`
3. **Collaboration:** `projects`, `project_memberships`, `task_assignments`, `comments`, `activity_log`
4. **File Intelligence:** `files`, `indexed_folders`, `document_embeddings`
5. **AI & Memory:** `conversations`, `ai_memories`, `memory_embeddings`, `agent_actions`
6. **Observability:** `agent_metrics`, `evaluation_logs`, `retrieval_logs`
7. **Knowledge:** `entity_relationships`, `tags`, `entity_tags`, `saved_views`
8. **Automation:** `notifications`, `scheduled_jobs`

### Schema Patterns

- UUID primary keys everywhere
- `user_id` foreign key on almost all tables with `ON DELETE CASCADE`
- Soft delete via `deleted_at` on `tasks` and `comments`
- `updated_at` maintained by a single PL/pgSQL trigger function
- Polymorphic references for tags/notifications/relationships without FKs
- JSONB for flexible metadata, checklists, entities, and embeddings

---

## Agent Runtime (Current)

The current runtime is **not yet the formal runtime described in `plan.md`** but has the basic shape:

```text
Agent
  └── systemPrompt
  └── run(context) -> calls fallbackManager.generateText() -> parses JSON -> calls tools
```

Each agent is a singleton class that:

1. Receives a context object (userId, message, recent messages, parsed dates, etc.).
2. Sends a prompt to an LLM via `fallbackManager`.
3. Parses the LLM's JSON response.
4. Dispatches to the appropriate tool.
5. Returns a text result.

The `AgentCoordinator` runs multiple agents in parallel when the orchestrator routes to more than one.

The orchestrator's system prompt explicitly lists all nine specialist agents (`task`, `event`, `place`, `file`, `memory`, `general`, `desktop`, `image`, `gemma`) and includes routing examples for each. The frontend **AI Control Center** (`frontend/src/pages/Agents.jsx`) mirrors this list in the agent-definition array.

### Provider Fallback Chain

```text
fallbackManager.generateText(agentType, messages, options)
  → picks providerPriority[agentType]
  → tries Groq / NVIDIA / OpenRouter in order
  → returns first successful result or all-providers-failed error
```

---

## File Intelligence Pipeline

```text
Desktop selects folder
  ↓
fileScanner lists files recursively
  ↓
fileReader extracts text (PDF/DOCX/TXT/CSV)
  ↓
documentProcessor chunks text (1500 chars, 200 overlap)
  ↓
LLM extracts entities (people, orgs, dates, locations, action items, summary)
  ↓
fallbackManager.generateEmbedding() creates embedding
  ↓
Chunks stored in document_embeddings (with JSONB fallback)
  ↓
knowledge/graphBuilder creates entity relationships
  ↓
User queries via chat/file agent
  ↓
retrieveDocuments uses ILIKE + optional vector similarity
  ↓
Retrieval logs and evaluation logs are written
```

---

## Scheduler Architecture

The scheduler is a collection of `node-cron` jobs defined in `backend/src/scheduler/index.js`:

| Job                    | Cron           | Purpose                                                |
| ---------------------- | -------------- | ------------------------------------------------------ |
| Reminder warnings      | `* * * * *`    | Create warning notifications before a reminder fires   |
| Reminder delivery      | `* * * * *`    | Mark due reminders and create ring notifications       |
| Task due               | `*/15 * * * *` | Notify about tasks due within the next hour            |
| Recurring tasks/events | `0 * * * *`    | Spawn the next occurrence of completed recurring items |
| Overdue tasks          | `0 8 * * *`    | Daily summary of overdue tasks                         |

All engines write to the `notifications` table. There is no push/email/Telegram delivery yet.

---

## Desktop Architecture

The Electron desktop app is intentionally thin:

- `electron/main.js` starts the Express backend in the same Node process and creates a `BrowserWindow`.
- The window loads the web frontend (Vite dev server in development, built `dist/` in production).
- `electron/preload.js` exposes a safe IPC bridge to the renderer.
- `electron/ipc/index.js` registers handlers for native operations.
- The actual file scanning, watching, and indexing logic lives in `backend/src/desktop/` and is triggered by both the desktop IPC and the backend API.

This design means the desktop and web apps share the same backend and frontend code, with Electron adding only OS-level capabilities (folder dialogs, native file open, file watching).

---

## Mobile Architecture

A `mobile/` directory exists as a **nested git repository** inside the monorepo. It is an Expo / React Native companion app:

- **Stack:** Expo 54, Expo Router 6, React Native 0.81, TanStack Query, Zustand, Axios, `expo-secure-store`, `expo-notifications`, `react-native-maps`.
- **Structure:** File-based routing under `mobile/app/`; hooks and components mirror the web frontend.
- **API:** Calls the same Express backend via `EXPO_PUBLIC_API_URL`; stores the JWT in secure storage.
- **Screens:** Dashboard, tasks, reminders, events, places, files, projects, chat, voice, notifications.

**Note:** Because it is a nested git repo, it is not tracked by the parent repo and can easily drift out of sync with the web and backend.

---

## Security Model (Current)

- JWT access tokens, 7-day expiry, stored in `localStorage` on the client.
- `authMiddleware` on most API routes.
- Rate limiting per route group.
- Password hashing with bcrypt (cost 10).
- No role-based access control.
- No refresh tokens or token revocation.
- No OAuth/token encryption.
- No explicit prompt-injection defenses beyond provider safety settings.

---

## Observability & Evaluation

- `agent_metrics` logs every LLM/agent call with latency, provider, model, tokens, success/error.
- `evaluation_logs` stores a simple groundedness score and hallucination risk heuristic.
- `retrieval_logs` tracks query/source/result counts.
- Frontend `Agents` page visualizes metrics with charts.
- No active evaluation harness or CI integration yet.

---

## Deployment Model (Current)

- Development: `npm run dev` runs frontend and Electron concurrently; `npm run dev` in backend runs nodemon.
- Database: manual `npm run migrate` in backend.
- Desktop packaging: `electron-builder` configured for Windows NSIS.
- No staging/production environment separation.
- No automated tests or CI/CD.
- No containerization (Docker) or cloud deployment configs.

---

## Frozen Architecture — Phase 2

**Status:** Frozen on 2026-08-10

Phase 2 of the development plan established a strict layer contract. No agent code may directly manipulate PostgreSQL. All persistent state changes and queries must flow through the tool/service layer so that validation, permissions, logging, and idempotency happen in one place.

### Layer Contract

```text
Frontend
   ↓ (HTTP / WebSocket)
API Routes
   ↓
Application Services (orchestrator, coordinator, context builders)
   ↓
Agents
   ↓ (call only)
Tools
   ↓ (validate, authorize, log)
Services / Database
```

### Rules

1. **Agents talk to Tools, not to the database.**
   - An agent must never import `pool` from `../db` or execute raw SQL.
   - An agent may call services such as `fileScanner` or `documentProcessor` only when those services are not database services; if they touch the database, they must be invoked through a Tool.

2. **Tools are the single database boundary.**
   - Every tool that performs a CRUD operation validates input, checks ownership via `context.userId`, handles idempotency, and writes to `agent_metrics` / `retrieval_logs` where appropriate.
   - Tools live in `backend/src/tools/` and are exported from `backend/src/tools/index.js`.

3. **Retrieval is a tool too.**
   - `retrieveDocuments` and `retrieveMemory` are wrapped as tools so agents do not import `retrieval/` modules directly.

### Current Tool Surface

```text
tasks:        createTask, updateTask, deleteTask, listTasks
events:       createEvent, updateEvent, deleteEvent
places:       searchPlaces
memory:       storeMemory, retrieveMemory
files:        searchFiles, retrieveDocuments, listIndexedFiles
images:       generateImage
admin:        getIndexedFolders, getIndexedFolderCount,
              getIndexedFiles, getIndexedDocumentCount,
              getRecentIndexedFiles, getFolderStatistics
```

### Verification

- `desktopAgent.js` no longer imports `pool` and uses `tools.getIndexedFolders`, `tools.listIndexedFiles`, and `tools.retrieveDocuments`.
- `fileAgent.js` uses `tools.retrieveDocuments` instead of an inline `retrieval/retrieveDocuments` import.
- All agent imports are at the top of each module; no inline `require` calls remain in hot paths.

---

## Target Architecture (from plan.md)

The `plan.md` document calls for evolving the current stack into a **personal AI operating system with controlled autonomy**:

```text
Feature
  → Domain Model
  → API / Service
  → Tool
  → Permission
  → Agent
  → Orchestrator
  → Verification
  → Event / Log
```

Key additions needed:

- Formal agent runtime with manifests, capabilities, permissions, schemas, and execution policies.
- Run/step state machine with planning, approval, verification, retry, and fallback.
- Autonomy levels (`MANUAL`, `SEMI_AUTO`, `AUTO`, `DISABLED`) per action type.
- AI gateway hiding provider details from agents.
- Structured output validation + business-rule verification.
- Event bus for cross-agent triggers.
- Gmail integration and email classification pipeline.
- Telegram remote-control interface.
- Device synchronization and conflict resolution.
- Proper versioned migrations, seeds, tests, and deployment environments.

This document describes the **current** architecture; the target architecture is defined in `plan.md` and will be tracked in `ROADMAP.md`.
