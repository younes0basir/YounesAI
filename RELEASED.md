# Released Features & System Architecture

This document provides a highly detailed, comprehensive log of all features, backend endpoints, database schemas, frontend pages, native desktop systems, and cross-platform mobile views that have been developed and released in the **Personal AI Assistant Dashboard** project.

---

## 📊 High-Level Architecture Overview

The application is structured as an advanced, secure, context-aware **four-tier architecture**:

1.  **Electron Desktop App Container**: Employs an isolated, sandboxed windowing environment using Electron `contextIsolation`. Operates background system processes directly under the desktop shell, providing native folder watch loops, file reader interfaces, and local document parsers.
2.  **Express.js + PostgreSQL Backend Service**: Acts as the intelligence layer, hosting the generic CRUD factory, custom domain controllers, cron-based automation scheduler engines, and the Multi-Agent AI Orchestrator. Runs dynamically inside the Electron main process during desktop execution.
3.  **React + Vite Single Page App (SPA)**: The user-facing administration dashboard. Uses Tailwind CSS for styles, Zustand for global frontend state variables, and TanStack Query (React Query) for optimistic server state synchronization and smart cache management.
4.  **React Native + Expo Mobile Application**: A cross-platform mobile client built with Expo Router's file-based navigation stack, mirror-matching the dashboard's capabilities.

```
       [ React + Vite UI ]           [ React Native Mobile ]
               │                                │
               ▼ (HTTP/WebSockets)              ▼ (HTTP)
   ┌────────────────────────────────────────────────────────┐
   │              Electron Application Shell                │
   │                                                        │
   │  ┌──────────────────────────────────────────────────┐  │
   │  │             Express.js API Server                │  │
   │  │                                                  │  │
   │  │  ┌──────────────────┐      ┌──────────────────┐  │  │
   │  │  │   Multi-Agent    │      │  Background Cron │  │  │
   │  │  │   Orchestrator   │      │  Scheduler       │  │  │
   │  │  └────────┬─────────┘      └────────┬─────────┘  │  │
   │  │           │                         │            │  │
   │  │  ┌────────▼─────────────────────────▼─────────┐  │  │
   │  │  │            Shared Retrieval Layer          │  │  │
   │  │  └──────────────────────┬─────────────────────┘  │  │
   │  └─────────────────────────┼────────────────────────┘  │
   │                            ▼                           │
   │                   [ PostgreSQL DB ]                    │
   │             (Vector search & Adjacency)                │
   └────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema & Entities

The relational database consists of **23 tables** structured to support rich tasks, location context, time-based alerts, multi-agent memory, collaboration, auditing, and advanced agentic retrieval.

### 1. User & Device Management

- **`users`**: Contains credentials and user profile records.
  - `id` (UUID, Primary Key): Unique identifier.
  - `email` (TEXT, Unique): User email address.
  - `display_name` (TEXT): Display name.
  - `password` (TEXT): Encrypted bcrypt credential.
- **`devices`**: Tracks active client hardware to coordinate sync variables.
  - `id` (UUID, Primary Key): Unique identifier.
  - `user_id` (UUID, Foreign Key ➔ `users.id`): Owner reference.
  - `name` (TEXT): Device descriptor.
  - `device_type` (TEXT): Enforced enum (`phone`, `laptop`, `tablet`, `desktop`).
  - `platform` (TEXT): OS platform (e.g., Windows, iOS, Android).
  - `last_sync` (TIMESTAMPTZ) & `sync_token` (BIGINT): Controls cross-device delta sync sequences.

### 2. Task Management

- **`tasks`**: Fully featured task node supporting subtask hierarchies, urgency metrics, and cron parameters.
  - `id` (UUID, Primary Key): Unique identifier.
  - `user_id` (UUID, Foreign Key ➔ `users.id`): Owner reference.
  - `parent_task_id` (UUID, Foreign Key ➔ self): Subtask hierarchy.
  - `title` (TEXT) & `description` (TEXT): Task titles and long descriptions.
  - `checklist` (JSONB): Array of subtasks with complete toggles.
  - `urgency` (SMALLINT, 1-5) & `priority` (SMALLINT, 1-5): Urgency ranking.
  - `status` (TEXT): State enum (`pending`, `in_progress`, `done`, `cancelled`, `archived`).
  - `quadrant` (TEXT): Enforced quadrant enum (`do_first`, `schedule`, `delegate`, `eliminate`).
  - `ai_priority_score` (FLOAT): Score calculated by the task agent.
  - `recurrence_rule` (TEXT) & `recurrence_interval` (INT): Event loop rule and interval.
  - `next_run_at` (TIMESTAMPTZ): Next scheduled execution.
  - `assigned_to` (UUID) & `completed_by` (UUID): User references.
  - `project_id` (UUID, Foreign Key ➔ `projects.id`): Workspace group link.
- **`task_assignments`**: Junction table mapping tasks to multiple user assignees.

### 3. Locations & Geo-Triggers

- **`places`**: Stores spatial points with notes, categories, and decimal coordinate values.
  - `id` (UUID, Primary Key): Unique identifier.
  - `user_id` (UUID, Foreign Key ➔ `users.id`): Owner reference.
  - `name` (TEXT) & `address` (TEXT): Landmark descriptions.
  - `category` (TEXT) & `notes` (TEXT): Category tags and details.
  - `latitude` & `longitude` (DOUBLE PRECISION): High-precision coordinate points.
- **`geofences`**: Bound parameters defining proximity actions.
  - `id` (UUID, Primary Key): Unique identifier.
  - `place_id` (UUID, Foreign Key ➔ `places.id`): Target location.
  - `reminder_id` (UUID, Foreign Key ➔ `reminders.id`): Triggered notification.
  - `radius_meters` (INT, default 200): Range threshold.
  - `trigger_type` (TEXT): Proximity criteria (`entry`, `exit`).

### 4. Scheduling & Reminders

- **`calendar_events`**: Event calendar schedules.
  - `id` (UUID, Primary Key): Unique identifier.
  - `starts_at` & `ends_at` (TIMESTAMPTZ): Duration constraints.
  - `title` (TEXT), `description` (TEXT), `location_text` (TEXT), and `color` (TEXT).
- **`reminders`**: Connects tasks or calendar events to active trigger alerts.
  - `id` (UUID, Primary Key): Unique identifier.
  - `trigger_at` (TIMESTAMPTZ): Scheduled alarm date/time.
  - `snoozed_until` (TIMESTAMPTZ): Temporary alarm delay.
  - `dismissed_at` (TIMESTAMPTZ): Deactivation log timestamp.

### 5. Document Indexing & Action Auditing

- **`files`**: Tracks metadata for user-uploaded workspace assets.
  - `path` (TEXT), `name` (TEXT), `extension` (TEXT), `mime_type` (TEXT), `size_bytes` (BIGINT), and `checksum` (TEXT).
- **`agent_actions`**: The core data table backing the application **Undo System**.
  - `action_type` (TEXT): Performed action (e.g. `create_task`).
  - `payload_before` & `payload_after` (JSONB): Complete state snapshots before and after execution.
  - `status` (TEXT): State identifier (`executed`, `reverted`, `failed`).
- **`indexed_folders`**: Tracks local directories scanned by the Electron desktop shell.
  - `folder_path` (TEXT), `is_active` (BOOLEAN), `last_scan` (TIMESTAMPTZ).
- **`document_embeddings`**: Holds overlapping text segments and vector indexes for local documents.
  - `file_path` (TEXT), `content` (TEXT), `embedding_json` (JSONB): Vector array fallback.
  - `entities` (JSONB): Extracted entity nodes (people, organisations, locations, dates).
  - `summary` (TEXT): AI-generated document summary snippet.
  - `file_type` (TEXT), `word_count` (INT), `chunk_index` (INT), `chunk_total` (INT).

### 6. Semantic RAG & Evaluation Metrics

- **`entity_relationships`**: The custom **Knowledge Graph** adjacency matrix mapping node connections.
  - `from_entity_type` (TEXT) & `from_entity_id` (UUID): Source node.
  - `relationship_type` (TEXT): Adjacency relationship (e.g. `PART_OF`, `ASSIGNED_TO`).
  - `to_entity_type` (TEXT) & `to_entity_id` (UUID): Target node.
  - `weight` (FLOAT, default 1.0): Proximity weights.
- **`evaluation_logs`**: Observability logs assessing LLM and retrieval accuracy.
  - `query` (TEXT): User prompt.
  - `retrieved_doc_count` (INT) & `retrieval_precision` (FLOAT).
  - `groundedness_score` (FLOAT): RAGAS-inspired factual score (0.0 to 1.0).
  - `hallucination_risk` (BOOLEAN): Flags low groundedness.
- **`retrieval_logs`**: Measures RAG search latencies and result counts across retrieval channels.

---

## 🧠 Backend Engine (`backend/`)

Built with Express.js and designed to operate both as an independent service and directly inside the Electron container.

### 1. Generic CRUD Router Factory (`src/lib/crud.js`)

- Dynamically builds parameterized API endpoints for all database tables.
- Enforces secure record isolation: queries automatically inject a `user_id = req.user.id` constraint when `userScoped: true` is configured.
- Intercepts deletions on target models to perform logical soft-deletes (`deleted_at = NOW()`) rather than destructive DB purges.

### 2. Multi-Agent Orchestration & Routing (`src/agents/`)

The AI layer is structured around the **"Decouple-and-Parse"** design pattern. It isolates intent classification, temporal extraction, tool execution, and contextual synthesis:

- **Orchestrator Agent (`orchestrator.js`)**: Analyzes the user's prompt to classify intent. It routes queries in parallel to the correct domain experts (`task`, `event`, `place`, `file`, `memory`, `desktop`, or `general`).
- **Temporal Parser Utility (`src/utils/temporalUtility.js`)**: Intercepts requests marked as time-sensitive. It leverages `chrono-node` to parse relative expressions (e.g., _"in 10 minutes"_) into clean, absolute ISO 8601 strings anchored to the client's current year (2026), and strips the time terms from the prompt before routing downstream.
- **Specialized Domain Agents**:
  - `taskAgent` & `eventAgent`: Consume pre-parsed temporal parameters (`dueAt`, `startsAt`) and construct valid, schema-checked parameters to trigger creation or modification tools.
  - `placeAgent`: Resolves geographic descriptors, locations, and coordinates.
  - `fileAgent`: Manages local file index operations. Rather than guessing file statuses, it executes the **File Management Tool Layer** queries directly against the database to guarantee accurate, un-hallucinated responses.
  - `memoryAgent`: Interacts with `memory_embeddings` to query or store personal user facts.
  - `desktopAgent`: Interface for native desktop commands (scan folders, launch file handlers).
  - `generalAgent`: Handles greetings, profile inquiries, and general conversations.
- **Provider Fallback Manager (`fallbackManager.js`)**: Protects the agents from LLM failures. It intercepts API exceptions, coordinates exponential-backoff retries, and handles automated model fallbacks across different API providers (Groq ➔ NVIDIA NIM ➔ OpenRouter).

### 3. File Management Tool Layer (`src/tools/fileManagementTools.js`)

Provides database-level functions that bypass LLM reasoning for file catalog inquiries:

- `getIndexedFolders()`: Retrieves monitored directory paths.
- `getIndexedFolderCount()`: Counts watched directories.
- `getIndexedFiles()`: Lists unique indexed document file paths.
- `getIndexedDocumentCount()`: Returns total text chunks stored.
- `getRecentIndexedFiles()`: Fetches recently indexed files.
- `getFolderStatistics()`: Aggregates file types, chunk counts, and monitored directories.

### 4. Shared Retrieval & Graph Engine (`src/retrieval/` & `src/knowledge/`)

- **Agentic Retrieval Planner (`agenticRetrieval.js`)**: Evaluates user prompts and schedules parallel data fetches across multiple internal indices (`retrieveDocuments`, `retrieveMemories`, `retrieveTasks`, `retrieveEvents`, etc.) before ranking the top 15 results.
- **Knowledge Graph Adjacency Builder (`graphBuilder.js`)**: Evaluates ingested files, maps entity nodes (People, Organisations, Locations, Dates), and registers adjacency relationships inside the `entity_relationships` matrix.

---

## 💻 Frontend Web App (`frontend/`)

Built as a single-page React app with Vite, Tailwind CSS, Zustand, and React Query.

### Pages Map & Routes

- `index` (`/` ➔ [Dashboard.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Dashboard.jsx)): Overview of the user's agenda, task completion rates, unread notifications, and quick actions.
- `tasks` (`/tasks` ➔ [Tasks.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Tasks.jsx)): Complete task list with sorting filters, drag-and-drop checklists, urgency badges, and quick toggles.
- `reminders` (`/reminders` ➔ [Reminders.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Reminders.jsx)): Chronological feed of upcoming/past reminders with immediate Snooze/Dismiss tools.
- `events` (`/events` ➔ [Events.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Events.jsx)): Calendar timeline view displaying events and quick scheduling configurations.
- `places` (`/places` ➔ [Places.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Places.jsx)): List and coordinates of saved geographic nodes with active category filters.
- `files` (`/files` ➔ [Files.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Files.jsx)): Visual directory of uploaded documents listing details, checksums, and deleted-status views. Includes monitored folder synchronization controls.
- `projects` (`/projects` ➔ [Projects.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Projects.jsx)): Collaborative projects panel displaying member rosters and active milestones.
- `search` (`/search` ➔ [Search.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Search.jsx)): Unified multi-category search interface.
- `notifications` (`/notifications` ➔ [Notifications.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Notifications.jsx)): Notification log with unread indicators.
- `agents` (`/agents` ➔ [Agents.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Agents.jsx)): AI debugging console showing real-time agent metrics, logs, response latencies, and token logs.
- `voice` (`/voice` ➔ [Voice.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Voice.jsx)): Interactive audio voice portal letting users speak tasks or queries directly to the agent.
- `chat` (`/chat` ➔ [Chat.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Chat.jsx)): Conversation terminal allowing conversational interaction with the Orchestrator. **Includes optimistic UI rendering** to append messages instantly and eliminate delay glitches during network exchanges.
- `auth/login` (`/auth/login` ➔ [Login.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Login.jsx)): User sign-in interface.
- `auth/register` (`/auth/register` ➔ [Register.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/frontend/src/pages/Register.jsx)): New user onboarding interface.

---

## 🖥️ Electron Desktop App (`electron/`)

A desktop shell for the application enabling native OS capabilities and deep AI integration with local files.

### Key Desktop Capabilities

- **Native File & Folder Access**: Interacts with local directories securely using IPC bridges.
- **Background Scanning & Monitoring**: Employs `chokidar` to recursively scan and monitor watched directories for file changes.
- **Offline Document Indexing**: Parses PDFs, DOCX, TXT, and CSV files, chunks them, and generates embeddings for the `document_embeddings` table.
- **Desktop Agent Integration**: A dedicated `desktopAgent` integrated into the Orchestrator to handle filesystem operations directly from user prompts.
- **Secure IPC Sandbox**: Strict separation using `contextIsolation: true` and `nodeIntegration: false` via a preload script exposing only authorized `window.api` methods.

---

## 📱 Mobile Client (`mobile/`)

A React Native mobile app utilizing Expo and Expo Router for responsive screens.

### Navigation Hierarchy

- **Authentication Stack (`app/(auth)/`)**
  - `login.jsx`: Mobile user sign-in screen.
  - `register.jsx`: Mobile user onboarding screen.
- **Tab Bar Navigation (`app/(tabs)/`)**
  - `index.jsx` (Dashboard): Home hub showcasing daily highlights, recent notifications, and quick shortcuts.
  - `tasks.jsx`: Task feed showing priority categories, toggleable status bubbles, and creation forms.
  - `reminders.jsx`: Live notification/alarm screen displaying action shortcuts (Snooze 10m, Dismiss).
  - `search.jsx`: Full global search screen covering tasks, files, and locations.
  - `more.jsx`: Secondary navigation drawer containing quick access links for:
    - AI Chat Panel (`chat.jsx`)
    - Voice Assistant (`voice.jsx`)
    - Calendar Events (`events.jsx`)
    - Shared Projects (`projects.jsx`)
    - Files View (`files.jsx`)
    - Places list (`places.jsx`)
    - System Notifications (`notifications.jsx`)
- **Dedicated Screen Components (`app/`)**
  - `chat.jsx`: Conversational console mirroring the web-chat console.
  - `voice.jsx`: Dictation utility mapping phone micro-recordings to Groq transcription pipelines.
  - `events.jsx`: List of upcoming activities.
  - `projects.jsx`: Project dashboards showing lists and descriptions.
  - `files.jsx`: Overview of uploaded user assets.
  - `places.jsx`: Directory listing of geographical locations and user coordinates.
  - `notifications.jsx`: Notification inbox matching backend events.
- **Shared Design System (`src/components/` & `src/theme/`)**
  - [Button.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/mobile/src/components/Button.jsx): Touch-friendly UI button component.
  - [Card.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/mobile/src/components/Card.jsx): Standard content layout panel.
  - [EmptyState.jsx](file:///c:/Users/basir/Documents/upf/stage%202026/mobile/src/components/EmptyState.jsx): Standard placeholder graphic for empty list arrays.
  - `FilterChips.jsx`: Interactive filter pills.
  - `LoadingState.jsx`: Centered activity indicators.
  - `PageHeader.jsx`: Unified header wrapper.
  - [colors.js](file:///c:/Users/basir/Documents/upf/stage%202026/mobile/src/theme/colors.js): Shared style parameters defining light/dark colors.
    : Shared style parameters defining light/dark colors.
