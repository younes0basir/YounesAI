# UI/UX Audit — Personal AI Assistant

**Phase 1 deliverable.** Read-only audit of the existing frontend. No code was modified.
Date: 2026-08-11 · Scope: `frontend/src/**` (React 18 + Vite + Tailwind CSS 4 + react-query + zustand + lucide-react)

---

## 1. Current architecture snapshot

### Routes (`src/App.jsx`)

`/`, `/tasks`, `/reminders`, `/events`, `/places`, `/files`, `/notifications`, `/search`, `/projects`, `/agents`, `/voice`, `/chat`, `/image-generator` — all under one flat `Layout` + `ProtectedRoute`. Auth lives at `/auth/login`, `/auth/register`.

### Shell (`src/components/Layout.jsx`, `Header.jsx`, `Sidebar.jsx`)

- Sticky glass `Header`: brand, search (hidden below `lg`), Zap→tasks shortcut, notifications bell, user menu, `Toaster`.
- Left `Sidebar` (17.5rem, collapsible below `xl`): Dashboard, "AI Assistant" featured panel (Chat / Agents / Voice / Image Gen), Workspace (Tasks / Events / Places / Files / Projects), Alerts & Search (Reminders / Notifications / Search), Quick create (Ask AI, New task, New event), "Ask AI anything…" box, version badge.
- Right rail (`hidden 2xl:block`, 18rem): **static** — Today events, Active reminders, "At a glance" mini-stats. Identical on every page.

### Styling (`src/index.css`, 1708 lines)

Tailwind 4 `@theme` tokens (primary = cyan, accent = violet) + a large hand-written layer: surfaces (glassmorphism), buttons, inputs, pills, badges, page-header, rail, agents-_, pipeline-_, sandbox-*, etc. `src/App.css` is leftover Vite-template CSS (unused).

### Shared UI components (`src/components/ui/`, `src/components/`)

`PageHeader`, `EmptyState`, `LoadingState`, `FilterPills`, `Card`, `MetricCard`, `TaskList`, `ActivityList`, `QuickActions`, `PipelineFlow` (under `components/agents/`).

### Data layer

`axios` instance (`src/lib/api.js`, `baseURL: '/api'`, Bearer token from localStorage) wrapped by react-query hooks in `src/hooks/` (14 hook files). Auth: zustand store + `ProtectedRoute` (token presence only).

### Tests / tooling

**No tests exist** — no vitest/jest/playwright/cypress configs or specs anywhere in the repo. Only lint script (`oxlint`). This directly affects Phase 9 planning.

---

## 2. Findings

Severity: **P0** = user-facing defect / blocks the product direction · **P1** = significant UX problem · **P2** = polish/consistency.

### A. Information architecture

| #   | Finding                                                                                                                                                                                                                     | Severity | Evidence                                                                  | Recommendation                                                                                                               | Risk   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1  | **Personal and developer products are mixed in one flat 13-route nav.** Sidebar puts Chat/Agents/Voice/ImageGen next to Tasks/Events/Files with no mode separation.                                                         | P0       | `Sidebar.jsx`, `App.jsx`                                                  | Regroup nav into Personal / Assistant / AI Studio sections (routes stay stable — see §3 migration map).                      | Low    |
| A2  | **`Agents.jsx` is a 1,115-line monolith: 7 tabs (Pipeline, Agents, RAG, Metrics, Benchmark, Sandbox, News) implemented as local state with no URL sync.** Tab lost on refresh; not deep-linkable; one page does everything. | P0       | `pages/Agents.jsx` L40–48, L86; tab content L271–1112                     | Split into tab components (still one route initially), then migrate to `/studio/*` sub-routes with redirects from `/agents`. | Medium |
| A3  | **Pipeline tab is the default view of the Agents page** — developer debugging UI is the first thing shown.                                                                                                                  | P0       | `Agents.jsx` L86 (`useState('dashboard')`)                                | Make Agents overview the default; pipeline becomes a Studio sub-page.                                                        | Low    |
| A4  | **5 competing chat entry points**: sidebar "Chat", "Ask AI" button, "Ask AI anything…" box, Agents header "Open chat", Sandbox chat (same `POST /agents/chat`).                                                             | P1       | `Sidebar.jsx` L7, L105–120; `Agents.jsx` header + sandbox tab; `Chat.jsx` | One canonical Assistant surface; sandbox stays but is explicitly labeled "dev playground".                                   | Low    |
| A5  | **Static right rail** — same Today/Reminders/mini-stats on every page; only visible ≥1536px, so on common laptop widths it is dead space.                                                                                   | P0       | `Layout.jsx` L35–109                                                      | Contextual per-page right panel (registry keyed by route), visible from `xl` or moved into page layout.                      | Medium |
| A6  | **Dashboard duplicates right-rail content** (Today events + metric counts) and overlaps focus banner + metric cards + rail.                                                                                                 | P1       | `Dashboard.jsx` L43–129 vs `Layout.jsx` L43–109                           | Home = greeting + "what needs attention"; metrics become compact, rail becomes contextual.                                   | Low    |
| A7  | Search results are **not navigable** (plain cards, no links); header search hidden below `lg` with no mobile equivalent.                                                                                                    | P1       | `pages/Search.jsx` L82–88; `Header.jsx` L52                               | Make results link to entities; add mobile search entry.                                                                      | Low    |
| A8  | **Dead / unused UI**: `QuickActions.jsx` FAB (zero imports), `useUpdateEvent` hook (no event edit UI), `useAgentTrends` hook, `App.css` Vite boilerplate.                                                                   | P2       | files listed                                                              | Delete or wire intentionally.                                                                                                | None   |
| A9  | PageHeader kicker **hardcodes "Overview"** on all 11 pages that use it.                                                                                                                                                     | P2       | `ui/PageHeader.jsx` L5                                                    | Make kicker a prop (section name).                                                                                           | None   |
| A10 | Reminders vs Notifications overlap conceptually (both are "things to tell me"); no Inbox concept exists yet.                                                                                                                | P2       | `Sidebar.jsx` L21–25                                                      | Keep routes; group under one nav area; reserve Inbox slot for future Gmail.                                                  | Low    |

### B. Design system & styling

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                               | Severity | Evidence                                                     | Recommendation                                                                                                  | Risk                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| B1  | **`index.css` contains entire sections duplicated twice with conflicting values** — Buttons, form controls, filter pills, badges, progress, nav, scrollbar, auth, animations (L631–806 vs L793–988). The second copy overrides badge colors with dark-theme values (e.g. `.badge-pending` `#b45309` → `#fbbf24`, `.badge-done` `#047857` → `#6ee7b7`) — **poor contrast on the light UI**; this is a live visual bug. | P0       | `index.css` L751–757 vs L913–919                             | Deduplicate to a single authoritative block; pick light-theme accessible colors.                                | Low                                                       |
| B2  | **Shared component adoption is uneven.** `PageHeader` 11/15 pages; `EmptyState` 8; `LoadingState` 9; `FilterPills` only Tasks; `Card`/`MetricCard` only Dashboard. Places, Chat, ImageGenerator, Voice reinvent styling (Places even uses `gray-*` vs global `slate-*`).                                                                                                                                              | P0       | per-page table §4                                            | Consolidate in Phase 3: one card, one stat, one filter, one empty/loading/error; migrate divergent pages.       | Medium                                                    |
| B3  | **No AI-state component system exists** — nothing represents Suggested / Waiting-for-approval / Running / Completed / Failed. Agent activity is invisible outside the Agents page.                                                                                                                                                                                                                                    | P0       | whole frontend (absent)                                      | Phase 3: build `AIStatusBadge` / `AIActionCard` / `AIProgress` primitives; wire to `agent_actions`/status data. | Medium                                                    |
| B4  | **Excessive glassmorphism + gradients**: layered radial-gradient body bg + blurred `surface` on everything + gradient buttons/pills/banners + per-item colored nav icons (violet/indigo/pink/cyan/emerald/blue/rose/amber/orange). Violates the 90/5/5 color balance.                                                                                                                                                 | P1       | `index.css` L46–72, L407–425; `Sidebar.jsx` tones            | Neutralize surfaces to flat/subtle; reserve cyan→violet for AI identity; semantic colors only for status.       | Medium (visual regression risk — needs screenshot review) |
| B5  | **~700 lines of page-specific CSS live in the global stylesheet** (`agents-*`, `pipeline-*`, `sandbox-*`, `ux-focus-*`).                                                                                                                                                                                                                                                                                              | P1       | `index.css` L990–1708                                        | Keep classes but group/section them; migrate to component-adjacent files during Phase 7.                        | Low                                                       |
| B6  | Dark surface tokens (`--color-surface: rgba(15,23,42,.28)`) don't match the light theme and inputs use `rgba(15,23,42,0.45)` backgrounds (dark inputs on light glass).                                                                                                                                                                                                                                                | P1       | `index.css` L21–23, L700, L861                               | Fix input backgrounds to light; audit token naming.                                                             | Low                                                       |
| B7  | Hardcoded hex/inline styles scattered in pages (agent colors, event color dots, chart fills `#8b5cf6`).                                                                                                                                                                                                                                                                                                               | P2       | `Agents.jsx` L349–390; `Events.jsx` L9; `Dashboard.jsx` L110 | Move to tokens / a single agent-color map.                                                                      | Low                                                       |

### C. States (loading / empty / error / success)

| #   | Finding                                                                                                                                                                                | Severity | Evidence                           | Recommendation                                                                                        | Risk |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- |
| C1  | **Most data pages have no query error state** — failed fetches render as "empty" (Tasks, Reminders, Events, Places, Files, Notifications, Projects, Search, Dashboard events section). | P0       | e.g. `Dashboard.jsx` L98–118       | Add `ErrorState` component + wire `isError` in every hook-consuming page (Phase 3 + per-page phases). | Low  |
| C2  | **Chat send failures are silent** (`console.error` only); no retry; clear-history also silent.                                                                                         | P0       | `Chat.jsx` L55–57, L62–69          | Toast + inline error + retry; use `api` helper instead of raw axios (L62).                            | Low  |
| C3  | **Hardcoded/misleading data presented as live**: "Groundedness 94%" fallback; "Total Cost (24h)" label regardless of time filter; retrieval stats pinned to 24h.                       | P1       | `Agents.jsx` L238, L964, L131      | Show real state or explicit "no data" empty state.                                                    | Low  |
| C4  | Mixed confirm UX: native `confirm()` for deletes (Tasks, Reminders, Events, Places, Files) vs custom modal in Chat.                                                                    | P1       | `Tasks.jsx` L89 etc. vs `Chat.jsx` | One `ConfirmDialog` component.                                                                        | Low  |
| C5  | Toasts exist (react-hot-toast) but success/error usage is inconsistent across CRUD pages.                                                                                              | P2       | various                            | Standardize mutation feedback in hooks.                                                               | Low  |

### D. Accessibility

| #   | Finding                                                                                                                                                                               | Severity | Evidence                                           | Recommendation                                                      | Risk   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| D1  | **Hover-only destructive actions** (delete/favorite/snooze revealed on hover) on Tasks, Reminders, Events, Files; Places never shows them without hover — unusable on touch/keyboard. | P0       | `Tasks.jsx` ~L230; `Places.jsx` ~L446              | Always-visible (or focus-visible) action buttons with `aria-label`. | Low    |
| D2  | Many icon-only buttons lack accessible names (Chat send/folder, event color dots, Tasks actions); some rely on `title` only.                                                          | P1       | `Chat.jsx` L181–198, L242–244; `Events.jsx` L61–63 | `aria-label` pass in Phase 8.                                       | Low    |
| D3  | **Color-only meaning**: orchestrator status dot in sidebar, agent latency bars (green/red, no text).                                                                                  | P1       | `Sidebar.jsx` L47–48; `Agents.jsx` L379–393        | Pair color with label/icon.                                         | Low    |
| D4  | Native `confirm()` not focus-managed; user menu lacks Escape handling/arrow-key nav; modals (Files, Chat) lack focus trap.                                                            | P1       | `Header.jsx` L71–85; `Files.jsx` ~L506             | Shared `Dialog`/`Menu` primitives with focus management.            | Medium |
| D5  | Positive: Agents tabs already use `aria-current`, `role="group"`, `aria-label` — keep this pattern as the reference.                                                                  | —        | `Agents.jsx` L252–269                              | Reuse pattern for all tab bars.                                     | —      |

### E. Responsive

| #   | Finding                                                                                                                                                        | Severity | Evidence                 | Recommendation                                                                          | Risk   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ | --------------------------------------------------------------------------------------- | ------ |
| E1  | **Chat has a fixed-height shell + always-visible 56px-wide history rail that shows only a message count** — wasted space on desktop, broken squeeze on mobile. | P0       | `Chat.jsx` L72–96        | Collapsible/omitted rail on mobile; make history real (conversation list) or remove it. | Low    |
| E2  | Right rail only at `2xl`; between 1280–1536px the layout is sidebar + content with unbalanced whitespace; no intentional middle breakpoint.                    | P1       | `Layout.jsx` L35         | Redefine breakpoints in Phase 4 (rail ≥ `xl` or inline panels).                         | Medium |
| E3  | Agents/benchmark tables rely solely on `overflow-x-auto` (6–9 columns) — cramped but functional on phones.                                                     | P1       | `Agents.jsx` ~L547, L767 | Card-list fallback below `md` or column prioritization.                                 | Medium |
| E4  | Pipeline diagram stacks < 1100px; acceptable, but header/legend wraps awkwardly.                                                                               | P2       | `index.css` L1326+       | Simplify mobile to vertical stepper (USER→ORCH→INTENT→AGENT→TOOLS→RESULT).              | Low    |

### F. Performance / technical

| #   | Finding                                                                                                                                          | Severity | Evidence                                      | Recommendation                                                      | Risk |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------- | ------------------------------------------------------------------- | ---- |
| F1  | **Agents page fires 8+ polling queries on mount (5s/15s/30s/60s intervals) regardless of active tab**, including monitoring/eval/news endpoints. | P1       | `Agents.jsx` L107–148                         | Tab-gated queries (`enabled: activeTab === …`) when splitting tabs. | Low  |
| F2  | Agents page duplicates `useAgentStatus` with its own 5s-polling query instead of using the hook.                                                 | P2       | `Agents.jsx` L107–111 vs `hooks/useAgents.js` | Single source via hook with shared query key.                       | Low  |
| F3  | No code-splitting: all 15 pages + recharts + leaflet load in the main bundle.                                                                    | P2       | `App.jsx` static imports                      | `React.lazy` per route (cheap, safe).                               | Low  |
| F4  | External map geocoding keys called from client (Mapbox/Geoapify fetch). Not UI-breaking; flag for later.                                         | P2       | `Places.jsx`                                  | Leave for now; document.                                            | None |

### G. Backend/API ↔ UI alignment (no mismatch found)

- All frontend calls map to existing backend routes (`/api/tasks`, `/api/calendar_events`, `/api/agents/*`, `/api/monitoring/*`, `/api/evaluation/summary`, `/api/news`, `/api/image/generate`, `/api/search`, etc.). **No genuine frontend/API mismatch discovered** — no backend changes required for Phases 2–7.
- One inconsistency: Chat clear-history uses raw `axios` with a hardcoded `/api` prefix instead of the shared `api` instance (C2 covers the fix).
- The backend already exposes agent actions/metrics (`/agent_actions`, `/agents/metrics/*`) sufficient to build the AI-state UX (B3) without backend changes; an approvals endpoint does **not** appear to exist yet — approval UI will need a small backend addition later (flagged, not in scope for UI phases).

---

## 3. Safest migration strategy (routes)

Principle: **no URL breaks during redesign.** Existing routes stay live; new IA is layered on top, then old routes become redirects.

| Current route                    | Target home          | Migration                                                                                                                                                                           |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` Dashboard                    | Personal → Home      | Redesign in place (Phase 5)                                                                                                                                                         |
| `/tasks`                         | Personal → Tasks     | Redesign in place                                                                                                                                                                   |
| `/events`                        | Personal → Calendar  | Redesign in place; alias `/calendar` later                                                                                                                                          |
| `/projects`, `/files`, `/places` | Personal             | Redesign in place; Places may fold into Files/Maps section later                                                                                                                    |
| `/chat`                          | AI → Assistant       | Becomes the canonical assistant surface (absorbs Voice actions contextually)                                                                                                        |
| `/voice`, `/image-generator`     | AI → Assistant tools | Keep routes; link from Assistant rather than top-level nav                                                                                                                          |
| `/agents`                        | Studio               | Split tabs → `/studio` (overview), `/studio/agents`, `/studio/pipeline`, `/studio/rag`, `/studio/evals` (Benchmark+Metrics), `/studio/sandbox`, `/studio/news`; `/agents` redirects |
| `/reminders`, `/notifications`   | System/Alerts        | Keep; regroup nav; consider merging into one "Inbox/Alerts" surface later                                                                                                           |
| `/search`                        | Global               | Keep page; add command palette (⌘K) in Phase 4 that deep-links into it                                                                                                              |

---

## 4. Shared-component adoption matrix

| Page           | PageHeader | EmptyState | LoadingState |  FilterPills   | Card/MetricCard | Notes                                     |
| -------------- | :--------: | :--------: | :----------: | :------------: | :-------------: | ----------------------------------------- |
| Dashboard      |     ✓      |     ✓      |      ✓       |       —        |        ✓        | events section missing loading state      |
| Tasks          |     ✓      |     ✓      |      ✓       |       ✓        |        —        | dual filter rows; hover-only actions      |
| Reminders      |     ✓      |     ✓      |      ✓       |       —        |        —        | hover-only actions                        |
| Events         |     ✓      |     ✓      |      ✓       |       —        |        —        | no edit UI; unlabeled color dots          |
| Places         |     ✓      |  ✗ custom  |   ✗ custom   |       —        |        —        | divergent styling (`gray-*`, raw buttons) |
| Files          |     ✓*     |     ✓      |      ✓       | ✗ custom chips |        —        | *no `action` slot used; custom modal      |
| Notifications  |     ✓      |     ✓      |      ✓       |       —        |        —        | no "mark all read"                        |
| Search         |     ✓      |  ✗ custom  |      ✓       |       —        |        —        | results not navigable                     |
| Projects       |     ✓      |     ✓      |      ✓       |       —        |        —        | cards non-interactive                     |
| Agents         |     ✓      |     ✓      |      ✓       |    ✗ custom    | ✗ custom stats  | monolith; heavy polling                   |
| Voice          |     ✓      |     —      |   ✗ custom   |       —        |        —        | overlaps Chat; `alert()` for mic denial   |
| Chat           |     ✗      |  ✗ custom  |   ✗ custom   |       —        |        —        | silent send errors; empty history rail    |
| ImageGenerator |  ✗ custom  |  ✗ custom  |   ✗ custom   |       —        |        —        | bypasses hooks (direct `api.post`)        |
| Login/Register |     —      |     —      |      —       |       —        |        —        | near-duplicate layouts                    |

---

## 5. Suggested implementation order (maps to requested phases)

1. **Phase 3 pre-step (safe, high value, zero redesign):**
   - Fix B1 (dedupe `index.css`, fix badge contrast) — pure deletion of duplicated block.
   - Delete dead code (A8: `QuickActions.jsx`, `App.css`).
   - Add `ErrorState` + wire C1/C2 (error states + Chat error toasts).
   - Fix D1 (always-visible actions) — small, independent.
2. **Phase 2 (IA doc):** navigation/mode design, contextual rail registry, command palette spec, approvals/AI-state data requirements.
3. **Phase 3 (design system):** tokens consolidation (B4, B6), primitives: Button/Input/Card/Badge/StatusPill/Dialog/ConfirmDialog/EmptyState/LoadingState/ErrorState/Skeleton + **AI-state components (B3)**: `AISuggestionCard`, `AIApprovalCard`, `AIProgressCard`, `AIResultCard`.
4. **Phase 4 (shell):** new Sidebar grouping (A1), contextual right rail (A5, E2), header cleanup (A4: single "Ask AI"), ⌘K palette, mobile nav.
5. **Phase 5 (core screens):** Home (A6), Tasks, Calendar, Assistant (E1, A4), Projects, Files.
6. **Phase 6 (AI experience):** activity feed, approvals, running/success/failure surfaces wired to `agent_actions`.
7. **Phase 7 (AI Studio):** split `Agents.jsx` into tab components → `/studio/*` routes (A2, A3), tab-gated queries (F1), pipeline simplified to USER→ORCH→INTENT→SPECIALIST→TOOLS→RESULT stepper with clickable inspector.
8. **Phase 8 (responsive/a11y):** D2–D4, E3, E4, focus states, contrast sweep.
9. **Phase 9 (testing):** introduce vitest + Playwright from scratch (nothing exists today) — start with smoke: login → create task → complete task → chat → navigation.

### Explicitly out of scope / do-not-touch (per safety rules)

- Auth flow, backend orchestration, DB schema, backend routes — no mismatches found.
- Pipeline functionality — relocated and redesigned, not deleted.
- No new UI framework; stay on Tailwind 4 + existing hand-rolled components (there is no shadcn/components.json in this project).

---

## 6. Summary — the 8 most important findings

1. **B1** — `index.css` is duplicated with conflicting badge colors (live contrast bug). _Fix first._
2. **A2/A3** — `Agents.jsx` (1,115 lines, 7 tabs, pipeline default) is the developer product living inside the personal product.
3. **A5** — right rail is static and identical everywhere; wasted space below 1536px.
4. **B3** — the entire AI-state language (suggested / approval / running / done / failed) is missing from the UI.
5. **C1/C2** — error states are absent on nearly every page; Chat errors are silent.
6. **B2** — shared components exist but adoption is patchy; Places/Chat/ImageGenerator diverge.
7. **A4** — five overlapping chat entry points dilute the Assistant as the product's center.
8. **D1/E1** — hover-only actions and the Chat layout are the worst touch/mobile offenders.
