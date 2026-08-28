# Personal AI OS — Complete Development Plan

## 0. Target

The final system should evolve from:

> **AI productivity platform**

into:

> **A reliable personal AI operating system with controlled autonomy.**

The target architecture:

```text
                         ┌─────────────────────┐
                         │       USER          │
                         │ Web / Desktop /     │
                         │ Mobile / Telegram   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   ASSISTANT CORE    │
                         │ Intent + Context    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    ORCHESTRATOR     │
                         │ Plan / Route / State │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
         TASK AGENT            EMAIL AGENT           FILE AGENT
         EVENT AGENT           MEMORY AGENT          DESKTOP AGENT
         PLACE AGENT           GENERAL AGENT         VOICE AGENT
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │    TOOL SYSTEM      │
                         │ Permissions + Risk  │
                         └──────────┬──────────┘
                                    │
          ┌─────────────┬───────────┼───────────┬────────────┐
          ▼             ▼           ▼           ▼            ▼
        Tasks         Gmail       Files       Calendar    Devices
          │             │           │           │            │
          └─────────────┴───────────┼───────────┴────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │     EVENT BUS       │
                         └─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ MEMORY / DATABASE   │
                         └─────────────────────┘
```

---

## Change Log

### 2026-08-10 — Phase 2 complete + frontend/backend fixes

- **Phase 2 (Architecture Freeze) completed.** Enforced the `Agent → Tool → Service → Database` rule; `desktopAgent.js` no longer directly queries PostgreSQL.
- **Image generation fixed.** `backend/src/services/imageGenerator.js` now parses NVIDIA FLUX.2 Klein's `artifacts[0].base64` response and returns a valid `data:image/png;base64,...` preview. `frontend/src/pages/ImageGenerator.jsx` shows a live generation status log.
- **Double `/api` prefix fixed.** `frontend/src/pages/Agents.jsx` now uses relative paths (`/monitoring/...`, `/evaluation/...`) against the shared Axios baseURL.
- **Orchestrator agent knowledge expanded.** `backend/src/agents/orchestrator.js` now explicitly describes `general`, `desktop`, and `gemma` agents with routing examples. `frontend/src/pages/Agents.jsx` dashboard lists all eight specialists.
- **Frontend build verified.** `npm run build` completed successfully.
- **System News feed added.** New `GET /api/news` endpoint and a System News tab on the Agents dashboard surface recent fixes and announcements.
- **Image Agent added.** `backend/src/agents/imageAgent.js` now routes text-to-image requests through the orchestrator; the Agents dashboard lists it alongside the other specialists.

### 2026-08-10 — AI chat reliability fixes (tasks, events, reminders, images)

- **Task/Event IDs now visible to the LLM.** `backend/src/agents/context.js` now prefixes each task/event in the agent prompt with `[id=UUID]`, so the LLM can output valid IDs for update/delete operations.
- **Task agent prompt improved.** Added explicit instructions to use context IDs for update/delete, plus examples for list, update, delete, and reminder operations.
- **Event agent `list` action added.** `backend/src/agents/eventAgent.js` now handles `list` requests via the new `tools/listEvents.js` tool.
- **Reminder routing fixed.** `remind me` and `reminder` keywords now route to the **task** agent (instead of memory). The orchestrator prompt includes reminder routing examples.
- **Reminder tools wired.** `createReminder.js` and `deleteReminder.js` are now registered in `tools/index.js` for future agent use.
- **Image agent config fixed.** Added `image` entry to `fallbackManager.providerPriority` and `config.js` (Groq + OpenRouter models).
- **Image passthrough fixed.** `orchestrator.formatFinalResponse` now propagates the `image` property from agent results to the final chat response.
- **SQL injection fix.** `updateTask.js` and `updateEvent.js` now use a column whitelist instead of blindly accepting any key from LLM output.
- **Null-ID guard added.** Task and event agents now return a clear message (instead of crashing) when the LLM omits `taskId`/`eventId` for update/delete.
- **Chat→Tasks cache invalidation.** `frontend/src/hooks/useChat.js` `useSendMessage` now invalidates `['tasks']` and `['events']` queries when a chat response includes those agents, so newly created tasks/events appear immediately on their respective pages without a manual refresh.
- **Agent response clarity.** Task/event creation responses now include due dates, priorities, and event start times — giving the orchestrator synthesis LLM enough context to produce accurate summaries instead of hallucinating.
- **Orchestrator synthesis anti-hallucination.** `formatFinalResponse` now instructs the synthesis LLM to never claim success if the agent reported failure.

### 2026-08-10 — LLM action override + context loss + response_format resilience

- **`action: 'chat'` override (root cause of "task ID not generated").** When the LLM returns valid JSON with `action: 'chat'` instead of actually performing the requested operation, `parseResponse` in `taskAgent`, `eventAgent`, and `memoryAgent` now detects the user's true intent via the fallback parser and overrides the action. For example, if the user says "create a task named internship for August 22" but the LLM returns `{ action: 'chat', response: 'I've attempted to create a task...' }`, the agent now extracts the title and due date and forces `action: 'create'` — so the task is actually created in the database.
- **Rich context no longer lost.** `AgentCoordinator.processRequest` (`agents/index.js`) was constructing `globalContext` without copying `activeTasks`, `upcomingEvents`, `memories`, `recentConversations`, or `relevantDocuments` from `buildContext`. Agents received empty context, so the LLM couldn't see existing tasks/events for update/delete operations. All five fields are now passed through.
- **`response_format` error recovery.** `modelClient.js` now detects 400/422 errors caused by `response_format: { type: 'json_object' }` (when a provider/model doesn't support JSON mode) and retries without it. The agent's fallback parser handles any non-JSON output.
- **Fallback routing temporal detection.** `orchestrator.getFallbackRouting` now detects temporal expressions (month names, relative dates, times) and sets `needs_parsing: true` with `raw_message`, so the coordinator's `parseTemporal` runs even when the orchestrator LLM fails and keyword routing is used.
- **Broader creation-intent regex.** Task agent's `fallbackParse` now also matches patterns like "add internship task" (verb + title + task) in addition to "create task named X".

### 2026-08-11 — Fallback parser title extraction + temporal typo handling + createTask resilience

- **Fallback parser title extraction fixed.** `taskAgent.fallbackParse` now uses a priority-based title extraction: first looks for `named/called/titled [X]` anywhere in the message (handles both "create task named X for Y" and "create task for Y named X" word orders), then falls back to standard create patterns. Previously, "create a task for 21 this month named internship" would extract "For 21 this month named internship" as the title instead of "Internship".
- **Temporal parser handles common typos.** `temporalUtility.parseTemporal` now pre-processes the message to fix typos like "mounth" → "month", "tommorow" → "tomorrow". Also added a priority check for "N this month" / "the Nth of this month" patterns that chrono-node misparses (chrono-node was returning August 1 instead of August 21 for "21 this month").
- **`createTask` three-tier fallback INSERT.** Added a minimal INSERT (only `user_id`, `title`, `priority`, `status`, `due_at`) as the last-resort fallback when the full and reduced INSERTs both fail. Also added `console.error` logging at each failure point so the exact database error is visible in server logs.
- **Task agent debug logging.** The task agent now logs the LLM raw response (first 200 chars), the parsed action, title, and due_at — so the exact failure point can be traced in server logs.

---

# PHASE 1 — Full Audit Before Changing Anything

**Priority: 🔴 CRITICAL**

Don't immediately add features.

First establish exactly what currently works.

Your documentation says the project is already substantially realized but specifically identifies operational hardening needs around **database reset/re-run behavior, extension handling, and deployment configuration**.

Create a master audit:

```text
SYSTEM AUDIT
│
├── Frontend
├── Backend
├── Database
├── Authentication
├── Agents
├── Orchestrator
├── Tools
├── AI providers
├── RAG
├── Memory
├── Scheduler
├── Desktop
├── Mobile
├── Notifications
└── Deployment
```

For every component record:

```text
Status:
✓ Working
⚠ Partially working
✗ Broken
? Unknown
```

Also record:

```text
Expected behavior
Actual behavior
Bug
Root cause
Priority
Dependencies
```

### Deliverable

Create:

```text
docs/
   SYSTEM_AUDIT.md
   KNOWN_BUGS.md
   ARCHITECTURE.md
   ROADMAP.md
```

---

# PHASE 2 — Freeze the Architecture

**Priority: 🔴**

Before adding more agents, define the boundaries.

Your current architecture already has four main layers — frontend, desktop, backend and mobile.

Keep that.

But formalize:

```text
Frontend
   ↓
API
   ↓
Application services
   ↓
Orchestrator
   ↓
Agents
   ↓
Tools
   ↓
Database / integrations
```

### Rule

An agent must **not directly manipulate PostgreSQL**.

Instead:

```text
Agent
 ↓
Tool
 ↓
Service
 ↓
Database
```

This prevents agents from inventing database operations.

---

# PHASE 3 — Fix Database Reliability

**Priority: 🔴 CRITICAL**

Your database is the backbone of everything.

You already have a fairly extensive schema covering tasks, events, reminders, files, memories, conversations, projects, logs and evaluation data.

Now audit:

### Database

- foreign keys
- indexes
- unique constraints
- cascading deletes
- nullable fields
- timestamps
- timezone handling
- soft deletion
- migrations
- seed data
- reset behavior
- duplicate records
- race conditions

### Especially fix

```text
migration
↓
migration
↓
migration
↓
migration
```

must always produce a reproducible database.

Create:

```text
db/
├── migrations/
├── seeds/
├── reset/
└── README.md
```

And test:

```text
fresh database
↓
migration
↓
seed
↓
application
```

from zero.

---

# PHASE 4 — Authentication + User/Device Identity

**Priority: 🔴**

You already have users and devices in the model.

Now make device identity a first-class concept.

```text
USER
 ├── PC
 ├── Laptop
 ├── Phone
 └── Telegram
```

Every action should know:

```text
user_id
device_id
source
timestamp
```

Example:

```json
{
  "user_id": "...",
  "device_id": "laptop_01",
  "source": "desktop",
  "action": "create_task"
}
```

This will become essential for synchronization.

---

# PHASE 5 — Build the Agent Runtime Properly

**Priority: 🔴 MOST IMPORTANT**

Your current agents are:

- Task
- Event
- Place
- File
- Memory
- Desktop
- General
- Voice

Keep them.

But create a standardized runtime.

## Every agent gets:

```text
Agent
├── manifest
├── capabilities
├── tools
├── permissions
├── input schema
├── output schema
└── execution policy
```

For example:

```json
{
  "name": "email_agent",
  "version": "1.0",
  "capabilities": ["read_email", "classify_email", "archive_email"],
  "risk": {
    "read_email": "low",
    "archive_email": "medium",
    "delete_email": "high",
    "send_email": "critical"
  }
}
```

---

# PHASE 6 — Agent Runs / Steps / State Machine

**Priority: 🔴**

This is one of the biggest upgrades.

Instead of:

```text
message → agent → response
```

use:

```text
RUN
│
├── PLAN
│
├── STEP 1
│
├── STEP 2
│
├── APPROVAL
│
├── STEP 3
│
├── VERIFY
│
└── COMPLETE
```

Database:

```text
agent_runs
agent_steps
tool_calls
tool_results
approvals
```

State:

```text
CREATED
↓
PLANNING
↓
EXECUTING
↓
WAITING_APPROVAL
↓
EXECUTING
↓
VERIFYING
↓
COMPLETED
```

Failure:

```text
FAILED
↓
RETRY
↓
FALLBACK
↓
HUMAN
```

This is where your current orchestration becomes much more robust.

---

# PHASE 7 — Human / Semi-Auto / Auto

**Priority: 🔴**

Implement the autonomy system you described.

Every action gets:

```text
MANUAL
SEMI_AUTO
AUTO
DISABLED
```

Example:

```text
read_email       → AUTO
create_task      → AUTO
archive_email    → AUTO
move_file        → SEMI_AUTO
send_email       → SEMI_AUTO
delete_email     → SEMI_AUTO
delete_file      → MANUAL
shell_command    → DISABLED
```

And let the user configure it.

### Dashboard

```text
AUTOMATION SETTINGS

Email
 ├─ Read                 AUTO
 ├─ Classify             AUTO
 ├─ Archive              AUTO
 ├─ Delete               APPROVAL
 └─ Send                 APPROVAL

Files
 ├─ Read                 AUTO
 ├─ Organize             APPROVAL
 ├─ Move                 APPROVAL
 └─ Delete               MANUAL
```

This becomes the **control center for your assistant's autonomy**.

---

# PHASE 8 — AI Gateway

**Priority: 🔴**

You use free NVIDIA, OpenRouter and Groq APIs.

Don't expose those providers to your agents.

Create:

```text
ai/
├── gateway/
├── providers/
│   ├── groq/
│   ├── nvidia/
│   └── openrouter/
├── routing/
├── schemas/
├── prompts/
└── fallback/
```

Agents call:

```typescript
ai.generate(...)
```

not:

```typescript
groq.generate(...)
```

### Gateway responsibilities

- provider selection
- model selection
- retries
- timeout
- fallback
- rate limiting
- structured output
- validation
- logging
- token tracking
- failure tracking

---

# PHASE 9 — Kill Hallucinations Systematically

**Priority: 🔴**

This should be treated as an engineering problem, not simply a prompt problem.

Every AI result goes:

```text
LLM
 ↓
Schema validation
 ↓
Context validation
 ↓
Permission validation
 ↓
Business-rule validation
 ↓
Tool execution
 ↓
Result verification
```

Example:

AI says:

```json
{
  "task_id": "123",
  "status": "completed"
}
```

Don't trust it.

Your backend checks:

```text
Does task 123 exist?
Does user own task 123?
Was it actually updated?
Did database transaction succeed?
```

Only then:

```text
SUCCESS
```

---

# PHASE 10 — Build the Evaluation System

You already have evaluation and retrieval logging in the project.

Now turn it into a real test suite.

Create:

```text
evals/
├── task/
├── event/
├── file/
├── memory/
├── email/
├── routing/
└── security/
```

Example:

```text
Input:
"Remind me tomorrow at 4 to call Younes"

Expected:

intent = create_reminder
date = ...
time = 16:00
```

Run hundreds of cases automatically.

Track:

```text
routing accuracy
tool accuracy
parameter accuracy
hallucination rate
failure rate
fallback rate
latency
```

This gives you objective progress.

---

# PHASE 11 — Fix RAG / Memory

Your existing file system already extracts, chunks, embeds and retrieves documents, while retrieval can include documents, memories, conversations, tasks, projects and events.

Now separate:

### Memory

```text
User preference
Fact
Decision
Instruction
Experience
Relationship
```

### Knowledge

```text
PDF
DOCX
TXT
CSV
Files
```

### Operational state

```text
Tasks
Events
Projects
Emails
Reminders
```

Don't mix all three blindly into one context window.

Use:

```text
Query
 ↓
Context planner
 ├── memory retrieval
 ├── document retrieval
 ├── task retrieval
 ├── event retrieval
 └── email retrieval
 ↓
rank
 ↓
context budget
 ↓
LLM
```

---

# PHASE 12 — Email Intelligence

**Priority: 🔴 NEXT BIG FEATURE**

Now we add the thing you specifically wanted.

## Gmail integration

Two accounts:

```text
gmail_account_1
gmail_account_2
```

Store:

```text
email_accounts
emails
email_threads
email_labels
email_sync_state
email_classifications
email_actions
email_rules
sender_profiles
email_feedback
```

### Pipeline

```text
GMAIL
 ↓
SYNC
 ↓
NORMALIZE
 ↓
RULE ENGINE
 ↓
CLASSIFIER
 ↓
DECISION ENGINE
 ↓
ACTION
```

Categories:

```text
IMPORTANT
ACTION_REQUIRED
PERSONAL
NEWSLETTER
PROMOTION
SPAM
UNKNOWN
```

---

# PHASE 13 — Email Learning

**Priority: 🟠**

If you repeatedly archive:

```text
company.com
```

the system learns.

Store:

```text
sender
domain
classification
user_action
frequency
last_seen
confidence
```

Then:

```text
AI prediction
+
rules
+
user history
=
final classification
```

Not:

```text
LLM = truth
```

---

# PHASE 14 — Email Dashboard

Create a dedicated space:

```text
AI INBOX
```

with:

```text
Important
Action Required
Personal
Promotions
Newsletters
Unknown
```

Actions:

```text
Archive
Delete
Mark important
Mute sender
Unsubscribe
Create task
Create reminder
Summarize
Ask AI
```

And:

> **"Why was this classified as promotion?"**

must show the evidence used.

---

# PHASE 15 — Event Bus

**Priority: 🟠**

Introduce a central event system.

Examples:

```text
email.received
email.classified
task.created
task.completed
task.overdue
event.starting
file.created
file.changed
agent.started
agent.failed
approval.required
```

Then:

```text
email.received
      ↓
Email Agent
      ↓
classification
      ↓
Task Agent
      ↓
possible task
```

This is how your system becomes proactive.

---

# PHASE 16 — Scheduler 2.0

You already have automated reminders, recurring tasks/events and overdue notifications.

Extend it into:

```text
TRIGGERS
│
├── time
├── email
├── task
├── file
├── calendar
├── location
└── system
```

Example:

```text
Every Monday 08:00
→ generate weekly briefing
```

or:

```text
When university email arrives
→ classify
→ notify if important
→ optionally create task
```

---

# PHASE 17 — Notification Center

Unify:

```text
Web
Desktop
Mobile
Telegram
```

through:

```text
notification service
```

Each notification:

```text
type
priority
source
user
device
action
expiration
read_status
```

---

# PHASE 18 — Telegram

**Priority: 🟠**

Use Telegram initially as the fastest mobile remote-control interface.

Commands:

```text
/tasks
/today
/inbox
/briefing
```

Natural language:

> "Remind me tomorrow to call the university."

Approval:

> "The AI wants to archive 37 emails."

Buttons:

```text
[Approve]
[Reject]
[Review]
```

---

# PHASE 19 — Desktop Agent

Your existing Electron layer already has local filesystem access and file watching.

Turn this into a proper device agent.

Capabilities:

```text
filesystem.read
filesystem.search
filesystem.watch
notification.send
clipboard
process information
```

Potentially later:

```text
controlled shell
application launching
automation
```

But keep dangerous operations behind explicit permissions.

---

# PHASE 20 — Device Synchronization

Eventually:

```text
             PERSONAL ACCOUNT
                    │
             CENTRAL BACKEND
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
      PC          LAPTOP        PHONE
```

Use:

```text
device_id
sync_version
event_id
updated_at
```

For conflict handling:

```text
server state
+
device state
↓
conflict resolver
```

Don't simply overwrite records.

---

# PHASE 21 — Daily AI Briefing

This becomes one of the first features that makes it feel like a **real personal assistant**.

Every morning:

```text
GOOD MORNING, YOUNES

Today:

📅 3 events
✅ 6 tasks
⚠️ 2 overdue
📧 4 important emails
📌 1 deadline approaching

Top priorities:

1. Finish PFA work
2. Respond to university email
3. Project meeting at 16:00

Potential issue:
You have 3 tasks scheduled during your meeting.

[Review day]
```

This combines your existing task/event/reminder system with the future email system.

---

# PHASE 22 — Assistant Memory

Eventually:

```text
MEMORY
│
├── Preferences
├── People
├── Projects
├── Decisions
├── Important facts
├── Previous actions
└── User corrections
```

And crucially:

```text
User correction
      ↓
memory
      ↓
future behavior
```

Example:

> "Don't automatically archive emails from my university."

The assistant should remember that.

---

# PHASE 23 — Observability Dashboard

Your project already has observability pages/metrics.

Expand them into:

```text
AI OPERATIONS
```

### Runs

```text
Run ID
Agent
Duration
Status
Model
Tokens
Tools
Errors
```

### Providers

```text
Groq
NVIDIA
OpenRouter
```

### Reliability

```text
Success rate
Failure rate
Fallback rate
Validation errors
Hallucinations
Human corrections
```

### Agents

```text
Task Agent
Email Agent
Memory Agent
...
```

You should be able to inspect any failed run.

---

# PHASE 24 — Security

**Priority: 🔴**

Before autonomous operations:

- API key encryption
- OAuth token encryption
- strict user isolation
- tool permissions
- rate limits
- audit logs
- input validation
- output validation
- file path restrictions
- command restrictions
- prompt injection defenses
- email content treated as untrusted input

Especially:

> **Never allow an email to instruct your agent to perform arbitrary actions.**

Email content is **data**, not instructions.

---

# PHASE 25 — Testing

Create four layers.

### Unit

```text
services
tools
database
rules
```

### Integration

```text
API → database
Agent → tools
Gmail → email pipeline
```

### AI evaluation

```text
intent
routing
extraction
classification
RAG
```

### End-to-end

```text
User
 ↓
UI
 ↓
API
 ↓
Orchestrator
 ↓
Agent
 ↓
Tool
 ↓
Database
 ↓
Notification
```

---

# PHASE 26 — Deployment

Only after stabilization:

```text
development
staging
production
```

Environment separation:

```text
.env.development
.env.staging
.env.production
```

Never commit secrets.

Add:

```text
health endpoint
database health
AI provider health
scheduler health
queue health
```

---

# PHASE 27 — Performance

Once everything works:

### Database

Indexes and query optimization.

### RAG

Caching and incremental indexing.

Your current pipeline already supports monitored folders and live watching, so don't repeatedly re-index unchanged files.

### AI

Cache:

```text
classification
embeddings
summaries
```

### Backend

Use queues for:

```text
email processing
embeddings
file indexing
AI jobs
notifications
```

Don't block API requests on long AI operations.

---

# PHASE 28 — Final UX

The final app should have roughly these areas:

```text
┌─────────────────────────────────────────┐
│ PERSONAL AI                             │
├───────────────┬─────────────────────────┤
│               │                         │
│ Dashboard     │ Today's overview        │
│ Tasks         │                         │
│ Calendar      │ Tasks                   │
│ Inbox         │ Events                  │
│ Projects      │ Important emails        │
│ Files         │ AI recommendations      │
│ Memory        │                         │
│ Automations   │                         │
│ Agents        │                         │
│ Devices       │                         │
│ AI Chat       │                         │
│ Settings      │                         │
│               │                         │
└───────────────┴─────────────────────────┘
```

And the most important screen:

# AI Control Center

```text
Assistant
────────────────────────────

What do you want me to do?

[ Ask anything... ]

Active operations
─────────────────

🟢 Cleaning inbox
   83/100 emails processed

🟡 Organizing project files
   Waiting for approval

🔵 Preparing daily briefing
   Scheduled 08:00

Recent decisions
─────────────────

✓ Archived 31 promotions
✓ Created 3 tasks
✓ Found 12 relevant documents
```

---

# The complete priority order

Don't implement these randomly.

## 🔴 Stage A — Stabilize

```text
1. Full audit
2. Fix existing bugs
3. Database reliability
4. Authentication/device identity
5. API consistency
6. Frontend/backend mismatches
7. Agent runtime
8. State machine
9. Tool validation
10. Error handling
```

## 🔴 Stage B — Make AI reliable

```text
11. AI Gateway
12. Structured outputs
13. Validation
14. Retry/fallback
15. Permissions
16. Human approval
17. Verification
18. Agent evaluation
19. Observability
```

## 🔴 Stage C — Email

```text
20. Gmail OAuth
21. Two-account synchronization
22. Email database
23. Classification
24. Rules
25. AI Inbox
26. Sender learning
27. Automatic actions
28. Approval workflow
```

## 🟠 Stage D — Automation

```text
29. Event bus
30. Scheduler 2.0
31. Notification service
32. Daily briefing
33. Proactive assistant
```

## 🟠 Stage E — Connectivity

```text
34. Telegram
35. Device identity
36. PC agent
37. Laptop agent
38. synchronization
39. mobile improvements
```

## 🟡 Stage F — Intelligence

```text
40. Memory 2.0
41. Personal preferences
42. Behavioral learning
43. Better RAG
44. Cross-domain reasoning
45. Long-running agent workflows
```

## 🟡 Stage G — Production

```text
46. Security audit
47. Performance
48. Automated tests
49. Deployment
50. Backup/recovery
51. Monitoring
52. Documentation
```

---

# The most important rule for the whole project

From now on, every new feature should pass through this architecture:

```text
                FEATURE
                   │
                   ▼
              DOMAIN MODEL
                   │
                   ▼
              API / SERVICE
                   │
                   ▼
                 TOOL
                   │
                   ▼
              PERMISSION
                   │
                   ▼
               AGENT
                   │
                   ▼
             ORCHESTRATOR
                   │
                   ▼
              VERIFICATION
                   │
                   ▼
             EVENT / LOG
```
