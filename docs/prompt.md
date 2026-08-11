# Prompt for Cursor — UI/UX Redesign Execution

> **How to use this file in Cursor:**
> 1. Open the project root in Cursor.
> 2. Open **Composer** (`Ctrl+I` / `Cmd+I`) for multi-file generation — this is where the main work happens.
> 3. For questions or quick lookups, use **Chat** (`Ctrl+L` / `Cmd+L`).
> 4. For inline edits in a single file, use `Ctrl+K` / `Cmd+K`.
> 5. Copy each phase prompt below into Composer as a **separate session**. Do one phase at a time.
> 6. Use `@file` to attach the referenced files so Cursor has full context.
> 7. Optionally, copy the **Project Rules** section into `.cursor/rules/ui-redesign.mdc` for persistent context across all Cursor sessions.

---

## Project Rules (paste into `.cursor/rules/ui-redesign.mdc` or attach once per Composer session)

```
Description: UI/UX redesign rules for the frontend codebase. Apply when editing any file under frontend/src/.
Globs: frontend/src/**
```

```markdown
- Tech stack: React 18 + Vite + Tailwind CSS v4 + TanStack React Query v5 + Zustand v4 + Lucide React + react-hot-toast
- All styling uses Tailwind utility classes + custom CSS in `index.css` (glassmorphism design system with @theme tokens).
- Shared components live in `frontend/src/components/` and `frontend/src/components/ui/`.
- Custom hooks live in `frontend/src/hooks/`. Data fetching uses React Query; auth uses Zustand.
- API calls go through the shared Axios instance at `frontend/src/lib/api.js` (baseURL: `/api`, auto-attaches Bearer token).
- Do NOT change backend routes, DB schema, or auth flow — frontend-only redesign.
- Preserve existing behavior unless a finding explicitly calls for a change. This is a redesign, not a rewrite.
- Use existing design tokens (primary-*, accent-*, surface, ink-*, border-*) from `index.css` — do not introduce new color values.
- Every page must have: PageHeader ✓, EmptyState ✓, LoadingState ✓, shared Card ✓ where applicable.
- Use `react-hot-toast` for mutation feedback — not `alert()` or `console.log()`.
- Run `npx oxlint` after changes to verify no lint errors.
```

---

## PROMPT START

### Phase 0 — Safe Cleanup

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach these files with `@`:
> `@frontend/src/index.css` `@frontend/src/components/ui/EmptyState.jsx` `@frontend/src/pages/Chat.jsx` `@frontend/src/pages/Dashboard.jsx` `@frontend/src/pages/Tasks.jsx` `@frontend/src/pages/Reminders.jsx` `@frontend/src/pages/Events.jsx` `@frontend/src/pages/Places.jsx` `@frontend/src/pages/Files.jsx` `@frontend/src/pages/Notifications.jsx` `@frontend/src/pages/Projects.jsx` `@frontend/src/pages/Search.jsx` `@frontend/src/components/ui/QuickActions.jsx` `@frontend/src/App.css`

I have a completed UI/UX audit of this codebase at `@frontend/UI_UX_REPORT.md`. Read it in full before doing anything else — it contains the finding IDs, file/line evidence, and the design system details. Use the audit as ground truth and verify against the live files only as needed.

**Ground rules for all phases:**
1. **No URL breaks.** Existing routes stay live throughout. New IA is layered on top; old routes become redirects only at the end of a phase, never mid-phase.
2. **No backend changes.** Auth flow, backend orchestration, DB schema, and backend routes are out of scope.
3. **Preserve existing behavior** unless a finding explicitly calls for a behavior change. Don't touch working data-fetching logic, react-query hooks, or zustand store shape unless a finding requires it.
4. **Use `@file` references** — always attach the files you need me to modify so you have full context.

Execute these findings from the audit:

- **B1:** `index.css` has duplicate sections (buttons, form controls, filter pills, badges, progress, nav, scrollbar, auth, animations) with conflicting values. The second copy overrides badge colors with dark-theme values that break contrast on the light UI. Deduplicate to one authoritative block using accessible, light-theme-appropriate colors.
- **A8:** Delete dead code — unused `QuickActions.jsx` FAB, unused `useUpdateEvent`/`useAgentTrends` hooks (confirm zero imports first), and leftover `App.css` Vite boilerplate.
- **C1:** Add a reusable `ErrorState` component in `@frontend/src/components/ui/` and wire `isError` handling into every page currently swallowing fetch failures as "empty" (Dashboard, Tasks, Reminders, Events, Places, Files, Notifications, Projects, Search).
- **C2:** Fix Chat's silent send/clear-history failures — replace the raw `axios` call with the shared `api` instance from `@frontend/src/lib/api.js`, add toast + inline error + retry.
- **D1:** Replace hover-only destructive/action buttons (delete/favorite/snooze on Tasks, Reminders, Events, Files, Places) with always-visible or focus-visible buttons that have proper `aria-label`s.

After completing this phase, run `npx oxlint` from `frontend/` and give me a summary of what changed.

---

### Phase 1 — IA Plan (design doc, not code)

> **Cursor setup:** Open **Chat** (`Ctrl+L`). Attach `@frontend/UI_UX_REPORT.md` `@frontend/src/components/Sidebar.jsx` `@frontend/src/components/Layout.jsx` `@frontend/src/App.jsx`

Before touching the shell, write a short IA design doc covering:
- The Personal / Assistant / AI Studio nav grouping (finding A1 from the audit)
- The contextual right-rail registry design (A5)
- The command palette (Cmd+K) spec
- What data the AI-state UX (B3) and future approvals flow will need from `/agent_actions` and `/agents/metrics/*`

Show me this doc before writing any shell code. Do NOT generate code in this phase — output the design doc only.

---

### Phase 2 — Design System

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach:
> `@frontend/src/index.css` `@frontend/src/components/ui/EmptyState.jsx` `@frontend/src/components/ui/LoadingState.jsx` `@frontend/src/components/ui/PageHeader.jsx` `@frontend/src/components/ui/FilterPills.jsx` `@frontend/src/pages/Agents.jsx`

Build the following using the audit findings and the Phase 1 IA doc as guidance:

- **Consolidate design tokens:** Fix the dark surface tokens that don't match the light theme and the dark input backgrounds on light glass (B6). Neutralize the excessive glassmorphism/gradient overuse toward a 90/5/5 color balance, reserving the cyan-to-violet gradient specifically for AI identity moments (B4).
- **Build shared primitives** in `frontend/src/components/ui/`: `Button`, `Input`, `Card`, `Badge`, `StatusPill`, `Dialog`, `ConfirmDialog` (replacing native `confirm()` calls per C4), `EmptyState` (already exists — extend if needed), `LoadingState` (already exists — extend if needed), `ErrorState` (created in Phase 0), `Skeleton`.
- **Build the AI-state component system** (B3): `AISuggestionCard`, `AIApprovalCard`, `AIProgressCard`, `AIResultCard`.
- **Move page-specific CSS** (~700 lines of `agents-*`, `pipeline-*`, `sandbox-*`, `ux-focus-*`) out of the global `index.css` into component-adjacent files, or at minimum clearly section them (B5).

After completing, run `npx oxlint` and summarize changes.

---

### Phase 3 — Shell

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach:
> `@frontend/src/components/Sidebar.jsx` `@frontend/src/components/Layout.jsx` `@frontend/src/components/Header.jsx` `@frontend/src/App.jsx` `@frontend/src/pages/Search.jsx`

Using the Phase 1 IA doc as guidance:

- **Regroup the sidebar** into Personal / Assistant / AI Studio sections (A1), keeping all routes stable.
- **Replace the static right rail** with the contextual per-page registry (A5).
- **Consolidate the five competing chat entry points** (sidebar "Chat", "Ask AI" button, "Ask AI anything..." box, Agents header "Open chat", Sandbox chat) into one canonical Assistant entry point. Sandbox chat stays but gets explicitly labeled as a dev playground (A4).
- **Add the Cmd+K command palette** that deep-links into Search.
- **Add mobile nav** (header search has no mobile equivalent today — fix as part of this pass, per A7).

After completing, run `npx oxlint` and summarize changes.

---

### Phase 4 — Core Screens

> **Cursor setup:** Open Composer (`Ctrl+I`). Do one page at a time. For each page, attach the page file + any shared components it imports.
> Start with: `@frontend/src/pages/Dashboard.jsx` `@frontend/src/components/Layout.jsx`

Redesign these screens using the new primitives from Phase 2:

- **Dashboard:** Remove duplication with the right rail; make it "greeting + what needs attention," compact metrics (A6).
- **Tasks, Events (Calendar), Chat (Assistant), Projects, Files:** Rebuild using shared primitives. Fix Places' divergent styling (`gray-*` to `slate-*`, custom buttons to shared primitives) as part of this pass (B2).
- **Search:** Make results navigable — link to the actual entities (A7).
- **Every page** should use: PageHeader / EmptyState / LoadingState / ErrorState / shared Card where applicable.
- **Fix PageHeader's hardcoded "Overview" kicker** — make it a prop (A9).

After each page, run `npx oxlint` and summarize.

---

### Phase 5 — AI Experience

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach:
> `@frontend/src/pages/Agents.jsx` `@frontend/src/pages/Dashboard.jsx` `@frontend/src/hooks/useAgents.js` `@frontend/src/components/ui/`

- Build the activity feed and running/success/failure surfaces wired to `agent_actions`, using the AI-state components from Phase 2.
- Flag clearly (do not build) that an approvals endpoint doesn't exist yet on the backend — note it as a follow-up, don't block this phase on it.
- Replace hardcoded/misleading "live" data (e.g. "Groundedness 94%" fallback, mistimed "Total Cost (24h)" label) with real state or an explicit "no data" empty state (C3).

After completing, run `npx oxlint` and summarize.

---

### Phase 6 — AI Studio

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach:
> `@frontend/src/pages/Agents.jsx` `@frontend/src/App.jsx` `@frontend/src/components/agents/PipelineFlow.jsx`

The `Agents.jsx` file is 1,115 lines with 7 tabs. Split and restructure it:

- **Split into separate tab components**, then migrate to `/studio/*` sub-routes: `/studio`, `/studio/agents`, `/studio/pipeline`, `/studio/rag`, `/studio/evals` (merging Benchmark+Metrics), `/studio/sandbox`, `/studio/news`. Add `/agents` redirecting to `/studio` (A2).
- **Change the default view** from Pipeline (developer debugging UI) to an Agents overview (A3).
- **Gate each tab's data queries** so they only run when that tab is active, not all seven polling simultaneously.
- **Simplify the pipeline view** to a USER → ORCH → INTENT → SPECIALIST → TOOLS → RESULT stepper with a clickable inspector.

After completing, run `npx oxlint` and summarize.

---

### Phase 7 — Responsive & Accessibility

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach the files that need accessibility fixes:
> `@frontend/src/pages/Chat.jsx` `@frontend/src/pages/Tasks.jsx` `@frontend/src/pages/Events.jsx` `@frontend/src/pages/Reminders.jsx` `@frontend/src/pages/Voice.jsx` `@frontend/src/components/Layout.jsx`

- Add `aria-label`s to icon-only buttons that currently lack them or rely on `title` alone (Chat send/folder, event color dots, Tasks actions) (D2).
- Address remaining accessibility findings D3/D4 from the audit (re-check the audit file for full details).
- Do a full contrast sweep given the color/token changes made in Phase 2.
- Fix Voice's `alert()` usage for mic-permission denial with a proper in-UI error state.
- Standardize toast usage for CRUD mutation feedback across all pages (C5).

After completing, run `npx oxlint` and summarize.

---

### Phase 8 — Testing

> **Cursor setup:** Open Composer (`Ctrl+I`). Attach:
> `@frontend/package.json` `@frontend/vite.config.js`

No test tooling exists in this repo today. Set it up:

- Introduce **vitest** + **Playwright**.
- Start with a smoke suite: login → create task → complete task → chat → navigation.
- Expand coverage from there, prioritizing the pages most reshaped in Phases 3–6.
- Add test scripts to `package.json`.

After completing, run the test suite and summarize results.

---

## Before You Start (for each phase)

1. Read `@frontend/UI_UX_REPORT.md` fully (only needed once — attach it in Phase 0).
2. Confirm you can see all files referenced in each phase — flag anything that's changed or missing.
3. Give me a one-paragraph confirmation of your plan for the current phase before writing any code.
4. Work one phase at a time. After each phase: run lint, self-review against the audit findings for that phase, and give me a summary of changes before moving on.

## PROMPT END