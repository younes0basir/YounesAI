# UI Information Architecture — Phase 1

**Design doc only. No code in this phase.** Ground truth for finding IDs: [docs/UI_UX_AUDIT.md](UI_UX_AUDIT.md).
Scope: navigation regrouping, contextual right rail, command palette, and the data available for AI-state UX. All existing routes stay live — this is a re-labeling/regrouping of what already exists, not a rebuild.

---

## 1. Navigation regrouping — Personal / Assistant / AI Studio (A1)

### Principle

The sidebar keeps its current three-tier layout (top brand link, scrollable middle, quick-actions footer) but the **middle section's grouping changes** from today's `AI Assistant panel / Workspace / Alerts & Search` to three labeled sections that match the product's two identities (personal assistant, primary; AI dev platform, secondary) plus one canonical AI entry point.

### Route → group mapping (no URL changes)

| Current route      | Current group      | New group                                                                                           | Notes                                                                                                  |
| ------------------ | ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                | Dashboard (pinned) | **Personal** — Home                                                                                 | Stays pinned above the groups, per current pattern                                                     |
| `/tasks`           | Workspace          | **Personal**                                                                                        | unchanged route                                                                                        |
| `/events`          | Workspace          | **Personal** — labeled "Calendar" in nav copy only                                                  | route stays `/events`; only the nav label changes to reduce jargon mismatch with the audit's target IA |
| `/projects`        | Workspace          | **Personal**                                                                                        | unchanged                                                                                              |
| `/files`           | Workspace          | **Personal**                                                                                        | unchanged                                                                                              |
| `/places`          | Workspace          | **Personal**                                                                                        | unchanged; audit note (A10) about folding into Files/Maps later is deferred, not decided here          |
| `/reminders`       | Alerts & Search    | **Personal** — grouped under an "Alerts" sub-label with Notifications                               | unchanged route                                                                                        |
| `/notifications`   | Alerts & Search    | **Personal** — same sub-label                                                                       | unchanged route                                                                                        |
| `/search`          | Alerts & Search    | **removed from top-level nav**, becomes command-palette-first (see §3)                              | route stays live and directly linkable; header search and `Cmd+K` both deep-link to it                 |
| `/chat`            | AI Assistant panel | **Assistant** (canonical entry, A4)                                                                 | unchanged route                                                                                        |
| `/voice`           | AI Assistant panel | **Assistant** — demoted to a tool linked _from inside_ the Assistant page, not a top-level nav item | route stays live for deep-linking/bookmarks                                                            |
| `/image-generator` | AI Assistant panel | **Assistant** — same demotion as Voice                                                              | route stays live                                                                                       |
| `/agents`          | AI Assistant panel | **AI Studio** (single nav item)                                                                     | route unchanged in this phase; internal 7-tab structure untouched until Phase 6 (A2/A3)                |

### Resulting sidebar structure (labels only — no code yet)

```
[Brand] Home                              → Personal
─────────────────────────────────────────
PERSONAL
  Tasks
  Calendar          (routes to /events)
  Projects
  Files
  Places
  Alerts            (Reminders + Notifications, badge = combined unread count)
─────────────────────────────────────────
ASSISTANT
  Assistant          (routes to /chat — canonical entry, absorbs "Ask AI")
─────────────────────────────────────────
AI STUDIO
  AI Studio          (routes to /agents, unchanged internal tabs for now)
─────────────────────────────────────────
[Quick create footer — unchanged: New task / New event]
```

### What this resolves from the audit

- **A1** — personal and developer nav items are no longer interleaved; AI Studio is visually and semantically separated as a distinct, smaller section.
- **A4** — of the five current chat entry points (sidebar "Chat", "Ask AI" button, "Ask AI anything…" box, Agents header "Open chat", Sandbox), the sidebar collapses to **one** "Assistant" item. The "Ask AI" quick-create button and "Ask AI anything…" box both already route to `/chat` today — in Phase 3 they become redundant with the single Assistant nav item and should be removed rather than kept as triplicate entry points. Agents header "Open chat" and Sandbox are addressed in Phase 6 (Sandbox gets an explicit "dev playground" label; "Open chat" stays as a convenience link since AI Studio and Assistant are different sections).
- **A9** — the `PageHeader` kicker becomes the group name ("Personal" / "Assistant" / "AI Studio") instead of the hardcoded "Overview" string, giving every page an at-a-glance sense of which mode it's in.

### What is explicitly NOT decided here

- Whether `/reminders` and `/notifications` eventually merge into a single "Inbox" route (audit A10) — deferred; for now they're just visually grouped under one "Alerts" sub-label while keeping two routes.
- The `/studio/*` sub-route split (A2/A3) — that's Phase 6. This phase only moves `/agents` into the "AI Studio" nav section; its internal tabs are untouched.

---

## 2. Contextual right-rail registry (A5)

### Problem being solved

Today's right rail (`RightSidebar` in [frontend/src/components/Layout.jsx](../frontend/src/components/Layout.jsx) L43-109) is a single hardcoded component rendered identically on all 13 pages, only visible at `2xl+` (≥1536px). It duplicates Dashboard content and never reflects what the current page is about.

### Design

Replace the single hardcoded `RightSidebar` with a **registry lookup keyed by route**, resolved once in `Layout.jsx` via `useLocation()`:

```js
// conceptual shape — not implemented in this phase
const railRegistry = [
  { match: (path) => path === '/', panel: HomeRailPanel },
  { match: (path) => path.startsWith('/tasks'), panel: TasksRailPanel },
  { match: (path) => path.startsWith('/events'), panel: CalendarRailPanel },
  {
    match: (path) =>
      path.startsWith('/chat') || path.startsWith('/voice') || path.startsWith('/image-generator'),
    panel: AssistantRailPanel,
  },
  { match: (path) => path.startsWith('/agents'), panel: StudioRailPanel },
];
// fallback: DefaultRailPanel (compact "at a glance" stats — today's mini-stat block) for any unmatched route
// (Projects, Files, Places, Reminders, Notifications, Search, Auth keep the fallback until a phase reshapes them)
```

Each `*RailPanel` is a small, independent component (own data hooks, own loading/empty state) — not one giant switch statement — so pages can be iterated on independently in later phases without touching the registry itself.

### Per-section rail content (matches the audit's target IA)

| Route family                                          | Rail content                                                                                                                                   | Data source (existing, no backend change)                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home** (`/`)                                        | Today overview, upcoming events (next 3-5), active task count, AI activity summary, pending-approvals slot                                     | `useEvents`, `useTasks`/`useTaskStats`, `/agent_actions` (recent rows) — approvals slot renders an explicit "no approvals yet" empty state (see §4 — no backend data model exists for this) |
| **Tasks** (`/tasks`)                                  | Task stats (open/overdue/done-today), priority breakdown, AI-suggestions slot                                                                  | `useTaskStats`, `useSmartTasks('overdue')`, `useSmartTasks('high_priority')` — AI-suggestions slot is an empty state for now (no suggestion-generation endpoint exists)                     |
| **Calendar** (`/events`)                              | Next event, upcoming list, AI-scheduling-suggestions slot                                                                                      | `useEvents` — suggestions slot is an empty state (no scheduling-suggestion endpoint exists)                                                                                                 |
| **Assistant** (`/chat`, `/voice`, `/image-generator`) | Current AI activity, recent agent runs, actions-awaiting-approval slot                                                                         | `useAgentStatus`, `/agent_actions` — approval slot is an empty state (§4)                                                                                                                   |
| **AI Studio** (`/agents`)                             | Agent health snapshot (from `useAgentStatus`), recent failures (`agent_metrics` success=false via `useAgentSummary`), shortcut to Pipeline tab | `useAgentStatus`, `useAgentSummary`                                                                                                                                                         |
| **Everything else** (fallback)                        | Compact "at a glance" stats — same content as today's mini-stat block (events/reminders counts)                                                | `useEvents`, `useReminders`                                                                                                                                                                 |

### Breakpoint change

Audit finding E2/A5 notes the rail is invisible between 1280–1536px. Recommendation: drop the rail's visibility breakpoint from `2xl` (1536px) to `xl` (1280px) once the panels are lighter-weight per-route components, since a focused single panel needs less width than the current three-stacked-panel version. This is a CSS-only change to apply in Phase 4, not this doc.

---

## 3. Command palette (Cmd/Ctrl+K) spec

### Goal

Give power users one fast path to navigate and act, and give Search (A7) a natural entry point beyond the header's `lg+`-only search bar (which has no mobile equivalent today).

### Trigger

- Global keyboard listener mounted once in `Layout.jsx` (or a small `CommandPaletteProvider` wrapping the authenticated shell): `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux). Also reachable via a visible button in the header (replaces the current non-functional `/` hint shown in the sidebar footer, which today does nothing — confirmed no keydown listener exists for it).
- Opens a centered modal/overlay (reuse the existing modal visual pattern from Chat's clear-confirm dialog: `fixed inset-0 bg-black/50` backdrop + centered panel) with a focus trap and `Escape` to close.

### Content model

Single input at the top; results grouped below, reusing the shared `useGlobalSearch` hook (no new fetching logic — same hook Search.jsx already uses):

1. **Quick actions** (static list, always shown when input is empty): "New task", "New event", "Ask AI" (→ `/chat`) — same actions as today's sidebar quick-create buttons, so this becomes their natural home once redundant sidebar buttons are removed per §1.
2. **Pages** (static, fuzzy-matched against nav labels): jumps to any route in the new Personal/Assistant/AI Studio structure.
3. **Live results** (debounced ~250ms, same debounce pattern already used in Places' search): tasks / files / places from `useGlobalSearch(query)`, capped to ~3 per group, each item navigable directly to the owning page.
4. **"See all results for '…'"** footer row — submits to `/search?q=...`, landing on the existing Search page (which A7 will make fully navigable in Phase 4).

### Keyboard interaction

- `↑`/`↓` moves selection across the flattened result list (quick actions → pages → tasks → files → places → "see all").
- `Enter` activates the selected item.
- `Escape` closes without navigating.
- Typing always keeps focus in the input (arrow keys don't need to leave it, matching common palette UX).

### Non-goals for this component

- No new dependency (no `cmdk`/`kbar`) — buildable with existing React state, the existing `useGlobalSearch` hook, and Tailwind, consistent with the "no new dependencies without justification" rule.
- No fuzzy-search library — simple substring/startsWith matching against the static nav list is sufficient; live entity results already come pre-filtered from the backend `/search` endpoint.

---

## 4. AI-state UX and approvals — data available today vs. gaps (B3)

### What exists today

| Endpoint                                                                                                            | Shape                                                                                                                                                                                                                                                   | Freshness                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /agents/status` ([backend/src/routes/agents.js](../backend/src/routes/agents.js) L214)                         | `{ status: { agents: [<names>], orchestrator: 'active', memory: {} }, metrics: [...] }` — `agents` is just a static list of agent name strings from `agentCoordinator.getStatus()` ([backend/src/agents/index.js](../backend/src/agents/index.js) L140) | Polled (Sidebar/Agents page poll every 5s); not push/real-time          |
| `GET /agents/metrics/summary?hours=`                                                                                | Per `agent_name`+`provider`: `total_calls, success_count, failure_count, avg_latency_ms, avg_success_latency_ms, total_tokens, last_call`                                                                                                               | Retrospective aggregate over a time window, not per-execution           |
| `GET /agents/metrics/benchmark?hours=`                                                                              | Adds `model`, computed cost from a hardcoded pricing table, success/hallucination/error rates                                                                                                                                                           | Retrospective aggregate                                                 |
| `GET/POST/PUT/DELETE /agent_actions` (generic CRUD, [backend/src/routes/api.js](../backend/src/routes/api.js) L523) | Row shape from `db.sql`: `action_type, payload_before, payload_after, status ('executed'\|'reverted'\|'failed'), created_at, user_id, device_id`                                                                                                        | Point-in-time log rows — closest thing to an activity/audit feed        |
| `conversations` rows (via `/agents/conversations`)                                                                  | `role, content, intent (comma-separated agent names), entities JSONB, created_at`                                                                                                                                                                       | Per-message, but `intent` has no link to a specific `agent_actions` row |

### What's missing for the target AI-state UX

The audit's target states are: **Suggested → Waiting for approval → Running → Completed → Failed**. Mapped against the schema above:

| Target state         | Backable today?                                                                            | Gap                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completed            | **Yes** — `agent_actions.status = 'executed'`                                              | none                                                                                                                                                                                                                                                                                                                                                             |
| Failed               | **Partially** — `agent_actions.status = 'failed'`, or `agent_metrics.success = false` rows | no unified single source; two tables disagree on granularity                                                                                                                                                                                                                                                                                                     |
| Running              | **No**                                                                                     | nothing pushes a live "in progress" signal; all data is polled aggregates or after-the-fact rows. Client-side, `isPending` from a mutation (e.g. `useSendMessage` in Chat) can drive an ephemeral "Running" card with zero backend change, but this only covers the single active request in front of the user, not a durable "what is my assistant doing" feed. |
| Suggested            | **No**                                                                                     | no table/column represents an AI-generated suggestion awaiting a user decision (e.g. "move this task to Friday?")                                                                                                                                                                                                                                                |
| Waiting for approval | **No**                                                                                     | `agent_actions.status` check constraint only allows `executed \| reverted \| failed` — no `pending_approval` value exists, and there's no linkage from a conversation turn to a specific pending action                                                                                                                                                          |

### Recommendation carried into later phases

- **Phase 5 (AI Experience)** can and should build the four presentational components (`AISuggestionCard`, `AIApprovalCard`, `AIProgressCard`, `AIResultCard`) as pure UI primitives now, and wire **only** `AIResultCard` (completed/failed) against `/agent_actions` + `/agents/metrics/summary` for a real activity feed. `AIProgressCard` can be wired client-side to in-flight mutations (e.g. Chat's `sendMessage.isPending`) for a transient "Running" indicator — this needs no backend change.
- `AISuggestionCard` and `AIApprovalCard` should render with real layouts but **no live data source** until a backend follow-up ships. This is called out explicitly as a **backend follow-up, not built in this pass or in Phase 5**: it would need either (a) a new `pending_approval` status value + a `confidence`/`agent_name` column on `agent_actions`, or (b) a small new `agent_suggestions` table. Flagging this is required by the plan; implementing it is out of scope for the frontend-only phases.

---

## Summary of what changes and when

| Item                                                              | This doc (Phase 1)           | Implemented in                                               |
| ----------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| Sidebar regrouping into Personal/Assistant/AI Studio              | Specified                    | Phase 3 (Shell)                                              |
| Removing redundant "Ask AI" / "Ask AI anything…" buttons          | Specified                    | Phase 3 (Shell)                                              |
| Contextual right-rail registry + per-route panels                 | Specified                    | Phase 3 (Shell), panel content refined per-page in Phase 4/5 |
| Rail breakpoint `2xl` → `xl`                                      | Specified                    | Phase 4                                                      |
| Command palette                                                   | Specified                    | Phase 3 (Shell)                                              |
| `PageHeader` kicker prop (group name instead of "Overview")       | Specified (A9)               | Phase 3/4                                                    |
| AI-state components (presentational)                              | Specified                    | Phase 2 (Design System)                                      |
| AI-state components wired to real data (Completed/Failed/Running) | Specified                    | Phase 5 (AI Experience)                                      |
| Suggested / Waiting-for-approval data model                       | Flagged as backend follow-up | Not in scope for Phases 0-8                                  |
| `/studio/*` route split, tab default change                       | Out of scope for this doc    | Phase 6 (AI Studio)                                          |
