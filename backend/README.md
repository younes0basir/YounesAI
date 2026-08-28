# Backend — Personal AI Assistant

Express.js + PostgreSQL backend with a generic CRUD engine and a multi-agent AI system.

---

## Stack

| Layer       | Tech                                         |
| ----------- | -------------------------------------------- |
| Runtime     | Node.js                                      |
| Framework   | Express 4                                    |
| Database    | PostgreSQL 13+ (via `pg`)                    |
| Auth        | JWT (`jsonwebtoken` + `bcryptjs`)            |
| AI SDK      | `groq-sdk` (primary), NVIDIA NIM, OpenRouter |
| File upload | `multer`                                     |
| API docs    | `swagger-ui-express`                         |

---

## Project Structure

```
backend/
├── src/
│   ├── index.js          # App entry — mounts all routers
│   ├── db.js             # PostgreSQL connection pool
│   ├── migrate.js        # Schema migration runner (reads db.sql)
│   ├── swagger.js        # Auto-generates Swagger UI from CRUD resources
│   ├── middleware/
│   │   └── auth.js       # JWT auth middleware
│   ├── lib/
│   │   └── crud.js       # Generic CRUD router factory
│   ├── routes/
│   │   ├── health.js     # GET /api/health
│   │   ├── auth.js       # POST /api/auth/{register,login}, GET /api/auth/me
│   │   ├── api.js        # 20+ CRUD resource routes + custom endpoints
│   │   └── agents.js     # Multi-agent chat, voice, memory, status
│   └── agents/
│       ├── index.js          # AgentCoordinator — routes, parallel dispatch, response assembly
│       ├── orchestrator.js   # Central orchestrator — intent analysis, agent selection, response formatting
│       ├── config.js         # Model assignments per provider (Groq, NVIDIA, OpenRouter)
│       ├── modelClient.js    # Base HTTP client + GroqClient, NvidiaClient, OpenRouterClient
│       ├── fallbackManager.js# Provider switching with exponential backoff
│       ├── taskAgent.js      # Task management agent (prompt-based)
│       ├── eventAgent.js     # Calendar/scheduling agent
│       ├── placeAgent.js     # Location/address agent
│       ├── fileAgent.js      # Document analysis agent
│       ├── memoryAgent.js    # Semantic search with in-memory vector store
│       └── voiceAgent.js     # Groq Whisper transcription
├── db.sql               # Full PostgreSQL schema (302 lines)
├── .env                 # Environment variables (gitignored)
├── .env.example         # Template for env vars
├── SETUP_GUIDE.md       # AI API key setup instructions
├── MULTI_AGENT_README.md# Legacy agent docs
└── package.json
```

---

## Entry Point (`src/index.js`)

Mounts five routers:

| Mount             | Router                                | File               |
| ----------------- | ------------------------------------- | ------------------ |
| `GET /api/health` | Health check                          | `routes/health.js` |
| `/api/auth`       | Login, register, me                   | `routes/auth.js`   |
| `/api`            | 20+ CRUD resources + custom endpoints | `routes/api.js`    |
| `/api/agents`     | Chat, voice, memory, status           | `routes/agents.js` |
| `/api/docs`       | Swagger UI                            | `swagger.js`       |

---

## Database (`db.js` + `db.sql` + `migrate.js`)

- **Pool**: single `pg.Pool` instance configured from env vars
- **Schema**: 20 tables defined in `db.sql` — all `CREATE TABLE IF NOT EXISTS`, uses `gen_random_uuid()` for UUIDs
- **Migration**: `node src/migrate.js` reads `db.sql`, splits statements safely (handles dollar-quoting, string literals, comments), runs them in multi-pass mode to resolve forward references, skips unavailable extensions

### Tables

| Table                 | Purpose                                                    | Scoped            |
| --------------------- | ---------------------------------------------------------- | ----------------- |
| `users`               | Auth + profile                                             | —                 |
| `devices`             | User devices                                               | user              |
| `tasks`               | Tasks with AI priority, checklist, recurrence, assignments | user, soft-delete |
| `places`              | Locations with lat/lng, visited flag                       | user              |
| `calendar_events`     | Events with recurrence, color, location                    | user              |
| `reminders`           | Reminders linked to tasks/events, snooze, dismiss          | user              |
| `geofences`           | Geo-triggers for places                                    | user              |
| `files`               | File metadata, checksum, deletion flag                     | user              |
| `agent_actions`       | Audit log for AI operations                                | user              |
| `conversations`       | Chat messages (user/assistant roles)                       | user              |
| `ai_memories`         | Stored AI memories with importance                         | user              |
| `notifications`       | User notifications (task_due, reminder_due, etc.)          | user              |
| `tags`                | User-defined tags                                          | user              |
| `entity_tags`         | Polymorphic tag associations                               | user              |
| `saved_views`         | Saved filter/sort presets                                  | user              |
| `projects`            | Collaboration projects                                     | —                 |
| `project_memberships` | Project roles (owner/editor/viewer)                        | —                 |
| `task_assignments`    | Task assignees                                             | —                 |
| `comments`            | Threaded comments on projects/tasks                        | user              |
| `activity_log`        | Audit trail for entities                                   | —                 |

---

## Auth (`middleware/auth.js` + `routes/auth.js`)

### JWT flow

1. `POST /api/auth/register` — creates user with bcrypt-hashed password, returns `{ user, token }`
2. `POST /api/auth/login` — validates credentials, returns `{ user, token }`
3. `GET /api/auth/me` — validates token, returns user profile
4. Token expires in **7 days**, signed with `JWT_SECRET` env var (required — no fallback)

### Middleware

`authMiddleware` extracts `Authorization: Bearer <token>`, verifies JWT, attaches `req.user = { id, email }`. Used on all CRUD routes and the chat endpoint.

---

## Generic CRUD Engine (`lib/crud.js`)

`createCrudRouter(pool, table, options)` generates 5 standard endpoints:

| Method   | Path               | Action                                               |
| -------- | ------------------ | ---------------------------------------------------- |
| `GET`    | `/api/{table}`     | List (filters via query params, max 100)             |
| `GET`    | `/api/{table}/:id` | Get by ID                                            |
| `POST`   | `/api/{table}`     | Create (validates columns from `information_schema`) |
| `PUT`    | `/api/{table}/:id` | Update (partial, same column validation)             |
| `DELETE` | `/api/{table}/:id` | Delete or soft-delete                                |

### Options

- `userScoped: true` — auto-filters/inserts `user_id` from JWT, prevents cross-user access
- `softDelete: 'deleted_at'` — sets timestamp instead of deleting rows
- `idCol` — custom ID column name (default `id`)
- `cols` — restrict returned columns

Special handling: `checklist` JSONB parsing (auto-converts newline/comma-separated string), `is_favorite` boolean normalization, `priority`/`urgency` numeric casting.

---

## Custom API Endpoints (`routes/api.js`)

Beyond the generic CRUD, these custom endpoints are mounted at `/api`:

| Endpoint                      | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `GET /tasks/smart?filter=`    | Smart task queries: `today`, `overdue`, `high_priority` |
| `GET /search?q=`              | Cross-resource search across tasks, files, places       |
| `POST /reminders/:id/snooze`  | Snooze a reminder (configurable minutes)                |
| `POST /reminders/:id/dismiss` | Dismiss a reminder permanently                          |
| `GET /projects`               | List projects (owned + member of)                       |
| `POST /projects`              | Create project with auto-membership                     |

### CRUD resources mounted (all auth-protected)

`/users`, `/devices`, `/tasks` (soft-delete), `/places`, `/calendar_events`, `/reminders`, `/geofences`, `/files`, `/agent_actions`, `/conversations`, `/ai_memories`, `/notifications`, `/tags`, `/entity_tags`, `/saved_views`, `/projects`, `/project_memberships`, `/task_assignments`, `/comments`, `/activity_log`

---

## Multi-Agent AI System

### Architecture

```
User (Voice / Text)
       │
       ▼
┌──────────────────┐
│   Orchestrator   │  Groq llama-3.3-70b-versatile (~200ms)
│  (intent + routing) │
└──────┬───────────┘
       │  returns list of agents
       ▼
┌──────────────────┐
│   Coordinator    │  calls agents in PARALLEL via Promise.all
└──────┬───────────┘
       │
  ┌────┼────┬────┬────┐
  ▼    ▼    ▼    ▼    ▼
task event place file memory
(Groq)      (NVIDIA)
       │
       ▼
┌──────────────────┐
│  Response        │  Orchestrator synthesizes final answer
│  Formatter       │  from all agent outputs
└──────────────────┘
```

### Agent Files

| File              | Agent         | Model                     | Provider | Latency |
| ----------------- | ------------- | ------------------------- | -------- | ------- |
| `orchestrator.js` | Orchestrator  | `llama-3.3-70b-versatile` | Groq     | ~200ms  |
| `taskAgent.js`    | Task          | `llama-3.1-8b-instant`    | Groq     | ~80ms   |
| `eventAgent.js`   | Event         | `llama-3.1-8b-instant`    | Groq     | ~80ms   |
| `placeAgent.js`   | Place         | `mixtral-8x7b-32768`      | Groq     | ~300ms  |
| `fileAgent.js`    | File          | `llama-3.1-70b-instruct`  | NVIDIA   | ~500ms  |
| `memoryAgent.js`  | Memory        | `bge-large-en-v1.5`       | NVIDIA   | ~400ms  |
| `voiceAgent.js`   | Voice/Whisper | `whisper-large-v3-turbo`  | Groq     | varies  |

### Fallback System (`fallbackManager.js`)

Each agent type has a provider priority list:

- **Task / Event / Place / Orchestrator**: Groq → OpenRouter
- **File / Memory**: NVIDIA → OpenRouter

On rate limit (429): exponential backoff, then switches to next provider.

### Memory Agent

In-memory `Map`-based vector store with cosine similarity search. Methods:

- `storeInformation(text, metadata)` — generates embedding, stores
- `semanticSearch(query, topK)` — finds most similar stored texts
- `clearOldMemories(maxAge)` — cleanup
- `retrieveContext(query)` — fetches relevant context for a query

Note: Not persisted to DB. In production, replace with a vector database (pgvector, Pinecone, etc.).

---

## Agent Routes (`routes/agents.js`)

All endpoints mounted at `/api/agents`:

| Endpoint                 | Auth | Description                                                                                  |
| ------------------------ | ---- | -------------------------------------------------------------------------------------------- |
| `POST /chat`             | Yes  | Send message → orchestrator → parallel agents → response. Persists to `conversations` table. |
| `GET /conversations`     | Yes  | Last 100 messages for the authenticated user                                                 |
| `POST /task`             | No   | Direct access to task agent                                                                  |
| `POST /event`            | No   | Direct access to event agent                                                                 |
| `POST /place`            | No   | Direct access to place agent                                                                 |
| `POST /file`             | No   | Direct access to file agent                                                                  |
| `POST /memory/store`     | No   | Store info in memory                                                                         |
| `POST /memory/search`    | No   | Semantic search in memory                                                                    |
| `POST /memory/clear`     | No   | Clear old memories                                                                           |
| `GET /status`            | No   | System status (agents, orchestrator, memory stats)                                           |
| `POST /voice/transcribe` | No   | Upload audio → Whisper transcription                                                         |
| `POST /voice/process`    | No   | Upload audio → transcribe → route through agent system                                       |

---

## Chat Flow (Production)

1. User sends message via `POST /api/agents/chat` (auth required)
2. Message saved to `conversations` table (role: `user`)
3. Orchestrator analyzes intent, returns list of agents to call
4. Coordinator calls all agents **in parallel** via `Promise.all`
5. Orchestrator **formats final response** combining all agent outputs
6. Response saved to `conversations` table (role: `assistant`, intent stores agent names)
7. Response returned to user: `{ success, response, agents: [...], metadata }`

---

## Swagger Docs

`GET /api/docs` serves Swagger UI with auto-generated OpenAPI 3.0 spec for all CRUD resources. Spec also available at `GET /api/docs/json`.

---

## Environment Variables

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=your_database
JWT_SECRET=your_jwt_secret_here

GROQ_API_KEY=gsk_your_groq_key
NVIDIA_API_KEY=nvapi-your_nvidia_key
OPENROUTER_API_KEY=sk-or-your_openrouter_key
```

---

## Scripts

```bash
npm run dev      # nodemon src/index.js
npm start        # node src/index.js
npm run migrate  # node src/migrate.js (runs db.sql)
```
