Project App Summary
===================

Overview
--------
This application is a Desktop AI Assistant and productivity dashboard built using Electron, containing user authentication, task/reminder management, place tagging, calendar scheduling, global/semantic document search, and a specialized Multi-Agent AI system.

Current Features
----------------
- **User Authentication**: Secure JWT login/register flow with rate-limiting protection.
- **Task Management**: Hierarchical tasks supporting descriptions, detailed notes, checklists (with auto-updating progress bar), urgency/priority weights, favorite flag, smart categories, and recurrence rules.
- **Smart Reminders**: Fixated trigger times with snooze (10m, 1h, 1d) and dismiss capability.
- **Places & Geofencing**: Local coordinate mapping, notes, categories, and geofence tracking.
- **Calendar Events**: Scheduling, custom repeat intervals, start/end dates, and location mapping.
- **In-App Notification Center**: Custom warning alerts for upcoming/overdue tasks, reminders, and system announcements.
- **Global & Semantic Search**: Standard keyword lookup across tasks, places, and files.
- **Collaboration (Projects & Comments)**: Collaborative project boards, membership controls (owner, editor, viewer), assignee task linkages, threaded comments, and audit activity history log.
- **AI Multi-Agent System**: Central orchestrator coordinating individual agents (Task Agent, Event Agent, Place Agent, File Agent, Memory Agent, Voice Agent, and the new Desktop Agent).
- **Electron Desktop Assistant**: Local file reading (PDF, DOCX, TXT, CSV), recursive folder scanning, live directory watching (using Chokidar), and semantic file indexing.

Backend
-------
- **Runtime**: Node.js + Express hosted inside the Electron main process.
- **Database**: PostgreSQL with pg pool.
- **Observer/Cron Engine**: Active cron engines tracking time-based actions (due reminders, recurring job roll-overs, daily overdue warnings).
- **Validation**: Joi schema interceptors validating LLM tool calls.
- **Observability**: Observatory endpoint `/api/agents/metrics/summary` logging LLM providers, token usage, latency, and success rates.
- **Security**: Strict API rate limiters and user-scoped data scoping.

Frontend
--------
- **Runtime**: React + Vite UI loaded inside Electron BrowserWindow.
- **State & Syncing**: TanStack React Query for DB synchronization, Zustand for local store.
- **Styling**: TailwindCSS with premium cards and list views.
- **Pages**: Dashboard, Tasks, Reminders, Events, Files (with Indexed Folders Dashboard), Places, Agents Observatory, Login, and Register.

Database Tables
---------------
- `users`: Authenticated profiles.
- `devices`: Multi-platform client syncing metadata.
- `tasks`: Action items with subtask progress and recurrence settings.
- `places` & `geofences`: Map coordinate entries and trigger rules.
- `calendar_events` & `reminders`: Schedule timelines and notifications.
- `files` & `indexed_folders`: Tracking local files and watched folders.
- `document_embeddings` & `memory_embeddings`: Vector embeddings for semantic search.
- `agent_metrics` & `scheduled_jobs`: Observability logs and worker task statuses.
- `projects`, `project_memberships`, `comments`, `activity_log`: Collaboration.

Roadmap & Future Enhancements
-----------------------------
1. **Push Notifications**: Expose native desktop push alerts and OS system tray integrations.
2. **Mobile App Offline Syncing**: Bring the React Native mobile codebase to match the desktop sync database protocol.
3. **Real-time WebSockets**: Introduce live comment feeds and task updates across multiple collaborated users.
4. **Advanced Recurrence**: Expand recurrence rule configurations to support complex RRULE expressions.
5. **Offline LLM Integrations**: Interface with local Ollama or Llama.cpp instances for 100% offline desktop capabilities.
