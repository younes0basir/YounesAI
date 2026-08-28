# Frontend UI/UX Detailed Report

> **Platform:** Personal AI Assistant — Stage 2026  
> **Scope:** Full frontend audit of visual design, interaction patterns, layout architecture, component library, and user experience flows  
> **Date:** August 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Visual Design System](#3-visual-design-system)
4. [Layout Architecture](#4-layout-architecture)
5. [Navigation & Information Architecture](#5-navigation--information-architecture)
6. [Component Library](#6-component-library)
7. [Page-by-Page UX Breakdown](#7-page-by-page-ux-breakdown)
8. [AI & Agent UX](#8-ai--agent-ux)
9. [Interaction Patterns & Micro-Animations](#9-interaction-patterns--micro-animations)
10. [Data Visualization & Charts](#10-data-visualization--charts)
11. [Loading, Empty & Error States](#11-loading-empty--error-states)
12. [Responsive Design Strategy](#12-responsive-design-strategy)
13. [Accessibility Audit](#13-accessibility-audit)
14. [State Management & Data Flow](#14-state-management--data-flow)
15. [Strengths](#15-strengths)
16. [Areas for Improvement](#16-areas-for-improvement)
17. [Recommendations](#17-recommendations)

---

## 1. Executive Summary

The frontend is a **single-page application** built with React 18, Vite 8, and Tailwind CSS v4. It serves as the web interface for a multi-agent personal AI operating system, providing unified access to tasks, events, reminders, places, files, projects, voice input, chat-based AI interaction, and image generation.

**Design language:** Glassmorphism meets calm productivity — translucent surfaces, layered radial gradients, and a cyan/violet accent palette sit on top of a soft slate/indigo background. The overall aesthetic is modern, airy, and deliberately uncluttered.

**Core UX philosophy:** _"Built for focus, not clutter"_ — every page follows a consistent header → filter → content → empty-state pattern, with a persistent three-column shell (left nav, main content, contextual right rail) on large screens.

---

## 2. Technology Stack

| Layer            | Technology                   | Purpose                                       |
| ---------------- | ---------------------------- | --------------------------------------------- |
| Framework        | React 18.2                   | Component-based UI                            |
| Build tool       | Vite 8.1                     | Dev server, HMR, bundling                     |
| Styling          | Tailwind CSS v4 + custom CSS | Utility-first + bespoke glassmorphism classes |
| Routing          | React Router DOM v6          | Client-side navigation with protected routes  |
| Data fetching    | TanStack React Query v5      | Server state, caching, polling, mutations     |
| State management | Zustand v4                   | Auth store (user, token, localStorage)        |
| HTTP client      | Axios                        | API calls with auth interceptor               |
| Charts           | Recharts v3                  | Bar charts, radar charts for agent metrics    |
| Maps             | React-Leaflet + Leaflet      | Interactive map for Places page               |
| Icons            | Lucide React                 | Consistent icon set across all pages          |
| Toasts           | react-hot-toast              | Non-blocking notifications                    |
| Date formatting  | date-fns                     | Human-readable date display                   |

---

## 3. Visual Design System

### 3.1 Color Palette

The design system is defined in `index.css` using Tailwind v4's `@theme` directive, establishing two primary accent families and a set of semantic surface/ink tokens.

**Primary (Cyan/Teal):**

| Token         | Value     | Usage                          |
| ------------- | --------- | ------------------------------ |
| `primary-50`  | `#ecfeff` | Hover backgrounds              |
| `primary-400` | `#22d3ee` | Focus rings, active indicators |
| `primary-500` | `#14b8d6` | Primary buttons, links         |
| `primary-600` | `#0ea5c5` | Brand gradients                |
| `primary-700` | `#0f766e` | Kicker badges, deep accents    |

**Accent (Violet/Purple):**

| Token        | Value     | Usage                             |
| ------------ | --------- | --------------------------------- |
| `accent-50`  | `#f5f3ff` | Subtle violet backgrounds         |
| `accent-500` | `#8b5cf6` | Agent badges, pipeline highlights |
| `accent-600` | `#7c3aed` | Orchestrator branding             |

**Semantic tokens:**

- `surface` / `surface-elevated` — translucent white layers with backdrop blur
- `ink` / `ink-muted` / `ink-subtle` — `#0f172a` / `#475569` / `#64748b` text hierarchy
- `border` / `border-strong` — low-opacity slate dividers

**Background composition:**
The body uses a multi-layer gradient stack:

```
radial-gradient(circle at top left, rgba(103, 232, 249, 0.18), transparent 24%),
radial-gradient(circle at top right, rgba(168, 85, 247, 0.12), transparent 28%),
radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.08), transparent 30%),
linear-gradient(135deg, #e2e8f0 0%, #f8fafc 25%, #eef2ff 100%);
```

This creates a soft, aurora-like backdrop that gives depth without competing with content.

### 3.2 Typography

- **Font family:** Inter (400, 500, 600, 700, 800) via Google Fonts
- **Fallback stack:** `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- **Rendering:** Antialiased on both macOS and Windows
- **Scale:** Fluid sizing using `clamp()` for headings (e.g., `clamp(1.9rem, 1.7rem + 0.7vw, 2.5rem)`)
- **Letter spacing:** Tight headings (`-0.06em`), normal body, wide uppercase labels (`0.08em–0.18em`)
- **Selection color:** Cyan tint (`rgba(34, 211, 238, 0.3)`) on light text

### 3.3 Elevation & Shadows

Three shadow tiers create depth hierarchy:

| Level       | Value                               | Usage                           |
| ----------- | ----------------------------------- | ------------------------------- |
| `shadow-sm` | `0 8px 20px rgba(15, 23, 42, 0.12)` | Cards, stat panels              |
| `shadow-md` | `0 14px 28px rgba(8, 15, 32, 0.18)` | Hover states, elevated surfaces |
| `shadow-lg` | `0 20px 44px rgba(6, 18, 29, 0.22)` | Modals, dropdowns               |

### 3.4 Border Radius Scale

| Token        | Value     | Usage                         |
| ------------ | --------- | ----------------------------- |
| `radius-lg`  | `0.75rem` | Buttons, inputs, small cards  |
| `radius-xl`  | `1rem`    | Surface panels, cards         |
| `radius-2xl` | `1.25rem` | Large modals, featured panels |
| `9999px`     | Full pill | Badges, filter pills, avatars |

### 3.5 Glassmorphism

The signature visual motif is frosted glass surfaces:

```css
.surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.12));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
}
```

Applied consistently across cards, panels, the header, sidebar, and rail.

---

## 4. Layout Architecture

### 4.1 Shell Layout

The authenticated app uses a **three-column shell** (`shell-layout`):

```
┌─────────────────────────────────────────────────────┐
│                    Header (sticky)                   │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Sidebar  │      Main Content        │  Right Rail   │
│ (17.5rem)│      (flex-1)            │  (18rem)      │
│          │                          │  (2xl only)   │
│          │                          │               │
└──────────┴──────────────────────────┴───────────────┘
```

- **Max width:** `1600px`, centered
- **Sidebar:** Fixed left, `17.5rem` wide, full viewport height minus header
- **Main content:** Flexible center column with `animate-fade-up` page transitions
- **Right rail:** Hidden below `2xl` breakpoint (`1536px`), shows contextual "Today" events, active reminders, and at-a-glance stats

### 4.2 Header

The header (`glass-header`) is a sticky glassmorphic bar:

- **Height:** `4rem` (`h-16`)
- **Background:** `rgba(255, 255, 255, 0.36)` with `backdrop-filter: blur(18px)`
- **Left:** Brand mark (gradient "AI" square) + workspace name
- **Center:** Glass search bar (hidden below `lg`) with `↵` keyboard hint
- **Right:** Quick tasks button, notification bell with unread badge, user menu dropdown

**User menu:** Dropdown with email display, overview link, and sign-out button. Uses click-outside detection via `useRef` + `mousedown` listener.

### 4.3 Sidebar Navigation

The sidebar organizes navigation into **four sections**:

1. **Dashboard** — Top-level home link
2. **AI Assistant panel** (featured) — Gradient-bordered card containing Chat, Agents, Voice, and Image Gen links, with a live orchestrator status dot
3. **Workspace** — Tasks, Events, Places, Files, Projects
4. **Alerts & Search** — Reminders, Notifications, Search
5. **Quick create** (footer) — "Ask AI" primary button, "New task" and "New event" secondary buttons, plus a shortcut bar showing `/` key hint

**Nav items** use a consistent pattern: colored icon tile + label + optional badge count or status dot. Active items get a left-border inset shadow (`box-shadow: inset 3px 0 0 rgba(34, 211, 238, 0.7)`) and a subtle gradient background.

**Mobile behavior:** Sidebar slides in from the left with a backdrop overlay on `xl` and below. Toggle button appears in the header.

### 4.4 Right Rail

Visible only on `2xl+` screens, the right rail provides contextual awareness:

- **Today panel:** Up to 5 events scheduled for today, with color-coded bars and time stamps
- **Active reminders panel:** Up to 5 unread reminders with bell icons
- **At a glance:** 2×2 stat grid showing total events and reminders counts

---

## 5. Navigation & Information Architecture

### 5.1 Route Structure

```
/                          → Dashboard (protected)
/tasks                     → Tasks
/reminders                 → Reminders
/events                    → Events
/places                    → Places
/files                     → Files
/notifications             → Notifications
/search                    → Search
/projects                  → Projects
/agents                    → AI Control Center
/voice                     → Voice & Text Agent
/chat                      → Chat
/image-generator           → Image Generator
/auth/login                → Login (public)
/auth/register             → Register (public)
/*                         → Redirect to /
```

All authenticated routes are wrapped in `<ProtectedRoute>` which checks for a JWT token in the Zustand store and redirects to `/auth/login` if absent.

### 5.2 Navigation Patterns

- **Primary navigation:** Sidebar with icon + label items grouped by domain
- **Secondary navigation:** Tab bars within pages (Agents page has 7 tabs)
- **Tertiary navigation:** Filter pills for data refinement
- **Cross-navigation:** "View all" links, metric card clicks, and sidebar quick actions all route to relevant detail pages
- **Search:** Global search in header navigates to `/search?q=...`

### 5.3 Information Hierarchy

The IA follows a **hub-and-spoke** model:

- **Hub:** Dashboard — shows today's focus, key metrics, recent tasks, today's events, and recent activity
- **Spokes:** Individual domain pages (Tasks, Events, Places, Files, etc.)
- **AI layer:** Chat, Agents, Voice, and Image Generator form a parallel AI interaction layer accessible from the sidebar's featured panel

---

## 6. Component Library

### 6.1 Buttons

| Variant   | Class               | Visual                                      | Usage                                            |
| --------- | ------------------- | ------------------------------------------- | ------------------------------------------------ |
| Primary   | `btn btn-primary`   | Cyan gradient, dark text, inner glow shadow | Main CTAs: "New task", "Sign in", "Generate"     |
| Secondary | `btn btn-secondary` | Translucent white, subtle border            | Secondary actions: "Close", "Cancel"             |
| Ghost     | `btn btn-ghost`     | Transparent, muted text                     | Tertiary: "Clear"                                |
| Icon      | `btn-icon`          | Small square, translucent bg, border        | Toolbars, action buttons (trash, star, settings) |

**Interaction states:**

- Hover: `translateY(-1px) scale(1.01)` with enhanced shadow
- Active: `translateY(0) scale(0.98)` — press-down feel
- Disabled: `opacity: 0.55; cursor: not-allowed`
- Transition: `cubic-bezier(0.2, 0.8, 0.2, 1)` for snappy, organic motion

### 6.2 Form Controls

- **Inputs:** Dark translucent background (`rgba(15, 23, 42, 0.45)`) with `0.75rem` border-radius
- **Focus state:** Cyan border (`rgba(103, 232, 249, 0.5)`) + `3px` cyan ring
- **Placeholder:** Muted slate at 70% opacity
- **Textarea:** Same styling as inputs, resizable
- **Select:** Custom styled with matching design

### 6.3 Badges

Seven semantic badge variants for status indication:

| Variant          | Color  | Usage                         |
| ---------------- | ------ | ----------------------------- |
| `badge-pending`  | Amber  | Pending tasks, warning states |
| `badge-progress` | Blue   | In-progress items             |
| `badge-done`     | Green  | Completed items               |
| `badge-muted`    | Gray   | Archived, neutral             |
| `badge-urgent`   | Red    | Urgent/overdue items          |
| `badge-priority` | Indigo | Priority levels               |
| `badge-repeat`   | Violet | Recurring items               |

All badges use pill shape (`border-radius: 9999px`), `0.6875rem` font, and `700` weight.

### 6.4 Cards & Surfaces

- **Card:** Simple wrapper applying `surface` or `surface-elevated` with `p-5` padding
- **MetricCard:** Interactive card with gradient accent background, icon, large value, and delta badge. Clickable to navigate.
- **Surface Interactive:** Adds hover effects — `translateY(-1px)`, border glow, enhanced shadow

### 6.5 Filter Pills

Horizontal pill-shaped toggle buttons for data filtering:

- **Primary variant:** Cyan gradient when active
- **Accent variant:** Violet gradient when active
- Inactive state: translucent white with subtle border

### 6.6 Page Header

Consistent page-level header component:

- **Kicker badge:** "OVERVIEW" in uppercase, tiny cyan-tinted pill
- **Title:** Large, tight-tracked heading with fluid sizing
- **Description:** Muted subtitle, max-width constrained
- **Action slot:** Right-aligned button area (e.g., "New task")

### 6.7 Empty State

Standardized empty state with:

- Gradient icon container (cyan-to-violet)
- Title and optional description
- Optional action button
- `bare` variant for inline use within cards

### 6.8 Loading State

Centered spinner with `animate-spin` on a Lucide `Loader` icon in primary color, plus configurable message text.

---

## 7. Page-by-Page UX Breakdown

### 7.1 Authentication (Login / Register)

**Layout:** Full-screen split — left panel (brand gradient with marketing copy) + right panel (form on slate background).

**Login flow:**

1. Email input with auto-focus
2. Password input with show/hide toggle (eye icon)
3. Submit button with loading spinner state
4. Error display: rose-tinted alert box with `AlertCircle` icon
5. Link to register page

**Register flow:**

- Adds display name field
- Real-time password validation (minimum 6 characters) with inline error
- Same visual structure as login

**UX details:**

- Authenticated users are redirected away from auth pages via `<Navigate to="/" />`
- On focus, error state is cleared (`login.reset()`)
- Brand mark appears in both panels on mobile (centered in form)
- Gradient panel uses radial overlay for depth

### 7.2 Dashboard

**Purpose:** Central hub showing today's priorities and key metrics.

**Sections (top to bottom):**

1. **Page header** — "Dashboard" + today's date + "Quick task" CTA
2. **Today's Focus banner** — Gradient surface with the top open task title, event count context, and two metric tiles (open tasks, events today)
3. **Metric cards row** — 3-column grid: Tasks (with open count delta), Reminders, Events. Each clickable to navigate.
4. **Content grid** (2:1 ratio):
   - Left: Recent tasks card (top 4 non-done tasks) + Today's events card
   - Right: Recent activity feed

**UX strengths:**

- Progressive disclosure — summary metrics link to full detail pages
- "Today's focus" banner provides a motivational starting point
- Empty states with CTAs for every section

### 7.3 Tasks

**Purpose:** Full task management with rich metadata.

**Features:**

- **Dual filter system:** Smart filters (All, Today, Overdue, High priority) as accent pills + status filters (All, Pending, In Progress, Done) as primary pills
- **Create form:** Expandable inline form with title, description, details, checklist, due date, recurrence, urgency (1–5), priority (1–5), and favorite toggle
- **Task cards:** Circle checkbox, title with strikethrough on done, favorite star, description, checklist preview (first 3 items), progress bar for subtask completion, status/urgency/priority/due date badges
- **Hover actions:** Star toggle and delete button appear on hover (desktop) or always visible (mobile)
- **URL query search:** Supports `?q=` parameter from global search
- **Overdue detection:** Red text for past-due items

### 7.4 Events

**Purpose:** Calendar event management with color coding.

**Features:**

- **Color picker:** 6 preset colors (blue, teal, amber, red, violet, pink) as circular swatches with ring selection indicator
- **Date/time inputs:** Start and end datetime-local pickers in a 2-column grid
- **Event cards:** Date badge (month + day), color bar, title, time range, location text
- **Multi-day detection:** Shows full date for end times spanning multiple days
- **Past events section:** Separated with reduced opacity and "Past · N" header

### 7.5 Places

**Purpose:** Location discovery and saving with map integration.

**Features:**

- **Dual geocoding:** Geoapify + Mapbox for stronger place discovery
- **Fuzzy search:** Custom scoring algorithm with prefix matching, token overlap, and Morocco-specific boosting
- **Interactive map:** Leaflet map with Geoapify tiles, CircleMarker for selected location (red) and saved places (blue)
- **Search UX:** Debounced (250ms) auto-search as you type, results list with "Use" action, auto-select on form submit
- **Visited/unvisited split:** Places grouped into "To Visit" and "Visited" sections
- **Map focus:** Clicking a place card centers the map on its coordinates
- **Multi-query expansion:** Builds variant queries (e.g., "cafe morocco", "cafe rabat") for broader coverage

### 7.6 Files

**Purpose:** Document management with folder monitoring and drag-and-drop upload.

**Features:**

- **File list:** Sortable by name/date/size, filterable by type (PDF, Doc, Text, Image, Audio, Video, Archive)
- **File type icons:** Extension-specific icons and color tones
- **Drag & drop:** Drop zone with visual indicator (dashed indigo border + upload icon)
- **Folder monitoring:** Expandable folder tree with file counts, "Sync Now" button for Electron, "Live" badge
- **Electron integration:** Native folder picker via `window.electron.selectFolder()` + folder scanning
- **Web fallback:** `webkitdirectory` input for browser-based folder import
- **Progress overlay:** Modal spinner during folder operations with step descriptions
- **Cascade delete:** Folder removal cascades to contained files

### 7.7 Reminders

**Purpose:** Timed and recurring alert management.

**Features:**

- **Rich creation form:** Title, message, trigger datetime, recurrence rule, warning lead time (minutes before)
- **Active/Completed split:** Active reminders shown first, completed (read/dismissed) below with reduced opacity
- **Action buttons:** Snooze (10 minutes), dismiss, mark read, delete — all appear on hover
- **Badge system:** Repeat badge for recurring, pending badge for voice warning, progress badge for snoozed, muted for dismissed

### 7.8 Notifications

**Purpose:** System-generated alert feed.

**Features:**

- **Type-coded badges:** `task_due` (blue), `task_overdue` (red), `reminder_warning` (amber), `system` (gray)
- **Unread highlighting:** Gradient background + primary border for unread items
- **Mark as read:** CheckCheck button on unread items
- **Header description:** Shows unread count or "You are all caught up"

### 7.9 Search

**Purpose:** Cross-domain workspace search.

**Features:**

- **Unified search bar:** Large, focused input with glass surface
- **Three-column results:** Tasks, Files, and Places shown in parallel cards
- **Section icons:** Color-coded per domain (emerald for tasks, slate for files, rose for places)
- **Result count:** Total matches displayed above results
- **URL sync:** Query persists in URL parameter for shareability

### 7.10 Projects

**Purpose:** Group tasks into collaborative workspaces.

**Features:**

- **Card grid:** Responsive 1/2/3-column grid with violet gradient backgrounds
- **Simple creation:** Name + description form
- **Status badge:** Active (green) or archived (gray)

### 7.11 Chat

**Purpose:** Conversational AI interface for the multi-agent system.

**Features:**

- **Message bubbles:** User messages (right-aligned, primary gradient) + AI messages (left-aligned, slate background)
- **Agent intent badges:** Colored pills below AI messages showing which agents handled the request (task, event, place, file, memory, general)
- **Timestamps:** Subtle time labels under each message
- **Typing indicator:** Three bouncing violet dots with staggered animation delays
- **Suggestion chips:** 6 pre-built prompts on empty state (e.g., "Create a task to review the project docs")
- **Folder scoping:** Dropdown to scope chat context to a specific indexed folder, with folder badge in input area
- **Clear all:** Confirmation modal with warning icon before deleting conversations
- **Auto-scroll:** Smooth scroll to bottom on new messages

### 7.12 Voice

**Purpose:** Voice and text input for the AI agent pipeline.

**Features:**

- **Voice input panel:** Large circular mic button that pulses red during recording, waveform visualization with 5 animated bars, audio playback after recording, "Process" button
- **Text input panel:** Textarea with send button for typed input
- **Response display:** Agent badges showing which agents were invoked, violet-tinted response card
- **Loading state:** "Orchestrating agents in parallel..." with spinning loader

### 7.13 Image Generator

**Purpose:** AI image generation via NVIDIA FLUX.

**Features:**

- **Split layout:** Form (left) + Preview (right) in 1.1:0.9 ratio
- **Prompt textarea:** 6 rows, min-height 120px
- **Size presets:** Square, Portrait, Landscape dropdown
- **Advanced controls:** Width/height number inputs (256–1536), steps (1–12), seed
- **Status log:** Timestamped generation steps in a scrollable feed, with the latest step highlighted in violet during generation
- **Preview:** Image display with aspect ratio matching, metadata card below (dimensions, seed, steps)
- **Empty state:** Dashed border placeholder with icon

### 7.14 AI Control Center (Agents)

**Purpose:** Comprehensive agent monitoring, benchmarking, and testing dashboard.

**This is the most complex page in the application** — it functions as a mini control tower with 7 tabs:

1. **Pipeline** — Interactive architecture diagram showing the 5-stage AI routing pipeline (Input → Orchestrator → Temporal Parse → Specialist Agents → Tools). Includes a step inspector sidebar and "Run in sandbox" button.

2. **Agents** — Grid of agent cards with search and status filter (All/Active/Idle). Each card shows: gradient icon, online/offline status, model name, provider, fallback chain, latency, and a performance bar chart.

3. **RAG** — Three-column stats for Document Index (files, chunks, type coverage), Knowledge Graph Matrix (nodes, edges, entity distribution), and RAG Retrieval Stats (queries, response times, hit rates).

4. **Metrics** — Observability logs with graph/table toggle. Bar charts for calls, success rate, latency, and tokens per agent. Live pipeline activity feed with color-coded progress bars.

5. **Benchmark** — Detailed performance analysis with success rate, latency, hallucination rate, error rate, groundedness score, and cost analysis. Includes radar chart for overall performance distribution and cost comparison.

6. **Sandbox** — Terminal-style testing interface with example chips, prompt input, and routed agent display in results.

7. **News** — System updates and release notes with category-coded badges (feature, fix, security, architecture).

---

## 8. AI & Agent UX

### 8.1 Pipeline Visualization

The `PipelineFlow` component is a standout UX feature — it visualizes the entire AI routing architecture as an interactive diagram:

- **5 clickable stages** with active/past/skipped states
- **4 walkthrough examples** (Task + date, Calendar event, File search, Multi-intent) that animate through the pipeline
- **Agent fan-out grid** showing all 9 specialist agents with routing highlights
- **Step inspector** sidebar with detailed descriptions for each stage
- **"Run in sandbox" button** that navigates to the sandbox tab with the example prompt pre-filled

### 8.2 Agent Status Awareness

- **Live status dot** in sidebar: Green pulse when orchestrator is active, gray when offline
- **Agent cards:** Real-time online/offline indicators with animated pulse
- **Chat intent badges:** Shows which agents handled each message
- **Voice response:** Displays invoked agent chain

### 8.3 Smart Cache Invalidation

The chat system intelligently refreshes related data:

- When a chat message routes to the `task` agent → tasks list auto-refreshes
- When routed to the `event` agent → events list auto-refreshes
- This creates a seamless "say it and see it happen" experience

---

## 9. Interaction Patterns & Micro-Animations

### 9.1 Page Transitions

Every page mount triggers `animate-fade-up`:

```css
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Duration: `0.35s` with `ease-out` easing and `both` fill mode.

### 9.2 Hover Effects

- **Cards:** `translateY(-1px)` + enhanced shadow + border glow
- **Buttons:** `translateY(-1px) scale(1.01)` + shadow expansion
- **Activity items:** Lift effect with cyan border highlight
- **Nav items:** Background brightening + border appearance

### 9.3 Progressive Disclosure

- **Task actions:** Delete and favorite buttons hidden until hover (desktop) or always visible (mobile)
- **Form visibility:** Create forms toggled via button, animated with `fade-up`
- **Folder expansion:** Click to reveal contained files

### 9.4 Feedback Patterns

- **Toast notifications:** Top-right positioned, dark background, 3-second duration, 12px border-radius
- **Loading spinners:** On buttons during mutations (e.g., "Signing in..." with spinner)
- **Badge counts:** Notification bell shows unread count (caps at "9+")
- **Inline status:** Agent cards show "active" with green pulse or "offline" with gray dot

### 9.5 Typing/Streaming Indicators

- **Chat:** Three bouncing dots with staggered delays (0ms, 150ms, 300ms) in violet
- **Voice:** Pulsing red circle with animated waveform bars during recording
- **Image Generator:** Status log entries with violet highlight on the latest step

---

## 10. Data Visualization & Charts

### 10.1 Chart Types (Recharts)

| Chart             | Data                                                                         | Location                 |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------ |
| Vertical bar      | Calls by agent, success rate, tokens                                         | Metrics tab              |
| Horizontal bar    | Latency by agent, cost comparison                                            | Metrics & Benchmark tabs |
| Grouped bar       | Success rate + latency overlay, hallucination + error rates                  | Benchmark tab            |
| Radar             | Overall performance distribution (success, groundedness, speed, reliability) | Benchmark tab            |
| Inline sparklines | Per-agent latency bars in agent cards                                        | Agents tab               |
| Progress bars     | Pipeline activity feed, task subtask progress                                | Metrics tab, Tasks page  |

### 10.2 Chart Styling

- Consistent tooltip design: `borderRadius: 8`, no border, subtle box shadow
- Grid: Dashed horizontal lines in `#e2e8f0`
- Bar radius: `[4, 4, 0, 0]` for vertical, `[0, 4, 4, 0]` for horizontal
- Agent-specific colors used consistently across all visualizations

---

## 11. Loading, Empty & Error States

### 11.1 Loading States

- **Page-level:** Centered spinner with message text
- **Button-level:** Spinner replaces icon text changes to "Loading..." / "Signing in..."
- **Data polling:** Silent background refresh (no loading indicator for cached data)

### 11.2 Empty States

Every list page has a tailored empty state with:

- Domain-specific icon (CheckSquare for tasks, Calendar for events, Bell for reminders, etc.)
- Contextual title and description
- CTA button to create the first item

### 11.3 Error Handling

- **Auth errors:** Inline rose-tinted alert box with icon, auto-cleared on input focus
- **Network errors:** Human-readable messages ("Cannot reach server — start the backend")
- **Mutation errors:** Toast notifications
- **Sandbox errors:** Inline error card with border and background
- **Search errors:** Toast notification ("Search failed. Please try again.")

---

## 12. Responsive Design Strategy

### 12.1 Breakpoints

| Breakpoint       | Layout Change                                     |
| ---------------- | ------------------------------------------------- |
| `< 640px` (sm)   | Single column, stacked headers, hidden search bar |
| `< 768px` (md)   | Pipeline diagram single column, agents grid 1-col |
| `< 1024px` (lg)  | Sidebar becomes overlay, search bar hidden        |
| `< 1280px` (xl)  | Sidebar toggle appears, sidebar slides in         |
| `< 1536px` (2xl) | Right rail hidden                                 |

### 12.2 Adaptive Patterns

- **Sidebar:** Full overlay on mobile, sticky on desktop
- **Page headers:** Stack vertically on mobile, horizontal on `sm+`
- **Metric cards:** 1-col → 3-col grid
- **Agent cards:** 1-col → 2-col → 3-col grid
- **Task actions:** Always visible on mobile, hover-only on desktop
- **Filter pills:** Wrap naturally with `flex-wrap`
- **Forms:** Single column on mobile, multi-column grid on `md+`

---

## 13. Accessibility Audit

### 13.1 Strengths

- **Semantic HTML:** Proper use of `<header>`, `<main>`, `<aside>`, `<nav>`, `<section>`, `<form>`
- **ARIA labels:** Toggle sidebar, notifications, user menu, search, time filter groups
- **`aria-current`:** Active nav items and pipeline stages marked
- **Keyboard support:** Enter-to-submit on inputs, `focus-visible` outline styles
- **Focus management:** Auto-focus on primary inputs (login email, search, task title)
- **Click-outside dismissal:** User menu dropdown and folder selector
- **Screen reader text:** `aria-hidden` on decorative elements
- **Color contrast:** Dark ink on light surfaces meets WCAG AA for body text

### 13.2 Gaps

- **No skip-to-content link** for keyboard navigation
- **Missing `aria-live` regions** for dynamic content (chat messages, toast notifications)
- **No `role="alert"` on error messages** in forms
- **Color-only status indicators** in some places (online/offline dots need text alternatives)
- **No focus trap** in the sidebar overlay on mobile
- **Confirm dialogs** use native `confirm()` which is not styleable and has inconsistent accessibility

---

## 14. State Management & Data Flow

### 14.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Zustand Store                     │
│         (Auth: user, token, login, logout)          │
├─────────────────────────────────────────────────────┤
│              TanStack React Query                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ tasks    │  │ events   │  │ reminders│  ...     │
│  │ queries  │  │ queries  │  │ queries  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
├─────────────────────────────────────────────────────┤
│                  Axios API Client                   │
│        (Base URL: /api, Auth interceptor)           │
├─────────────────────────────────────────────────────┤
│              Vite Dev Proxy                         │
│          (/api → localhost:3000)                    │
└─────────────────────────────────────────────────────┘
```

### 14.2 Data Fetching Patterns

- **Polling:** Agent status (5s), conversations (30s), monitoring data (15s), news (60s), pending alerts (15s)
- **Optimistic updates:** Not currently used — mutations invalidate queries instead
- **Cache invalidation:** Smart, targeted — chat only refreshes related entity lists based on routed agents
- **Auth persistence:** `localStorage` for token and user data, restored on app load

### 14.3 Custom Hooks

| Hook                                   | Purpose                             |
| -------------------------------------- | ----------------------------------- |
| `useTasks`, `useSmartTasks`            | Task CRUD + smart filtering         |
| `useEvents`                            | Event CRUD                          |
| `useReminders`                         | Reminder CRUD + snooze/dismiss      |
| `usePlaces`                            | Place CRUD + visit toggle           |
| `useFiles`, `useIndexedFolders`        | File management + folder monitoring |
| `useProjects`                          | Project CRUD                        |
| `useNotifications`                     | Notification feed + mark read       |
| `useChat`, `useConversations`          | Chat messaging + history            |
| `useVoiceProcess`                      | Voice audio processing              |
| `useAgents`, `useAgentStatus`          | Agent monitoring                    |
| `useAgentSummary`, `useAgentBenchmark` | Agent analytics                     |
| `useGlobalSearch`                      | Cross-domain search                 |
| `useDashboard`                         | Stats, activity, counts             |
| `usePendingAlerts`                     | Background alert polling + TTS      |
| `useLogin`, `useRegister`              | Auth mutations                      |

---

## 15. Strengths

1. **Cohesive design system** — Consistent glassmorphism, color tokens, and elevation scale create a unified visual language across all 14 pages.

2. **Excellent information density** — The three-column shell maximizes screen real estate on large displays while gracefully degrading on smaller screens.

3. **Thoughtful empty states** — Every list has a contextual empty state with a clear CTA, preventing dead-ends.

4. **Smart data refreshing** — Chat-triggered invalidation of related entity lists creates a responsive, connected feel without manual refresh.

5. **Rich agent observability** — The AI Control Center provides enterprise-grade monitoring with charts, benchmarks, and a sandbox — unusual and impressive for a personal assistant.

6. **Pipeline visualization** — The interactive architecture diagram is an outstanding educational and debugging tool that makes the AI system transparent.

7. **Progressive disclosure** — Hover actions, expandable forms, and tabbed interfaces keep the UI clean while providing depth on demand.

8. **Micro-animation polish** — `fade-up` page transitions, button lift effects, and typing indicators add life without being distracting.

9. **Multi-modal interaction** — Voice, text, and chat interfaces provide multiple ways to interact with the AI system.

10. **Geographic intelligence** — The Places page's fuzzy search with Morocco-specific boosting and multi-provider geocoding shows thoughtful localization.

---

## 16. Areas for Improvement

### Visual & UX

1. **No dark mode** — The entire UI is light-only. Given the glassmorphism aesthetic, a dark mode would be highly impactful and is a common user expectation.

2. **Inconsistent form styling** — The Places page's create form uses raw Tailwind classes (`bg-white border border-gray-100`) instead of the shared `surface-elevated` pattern used everywhere else.

3. **No confirmation for destructive batch actions** — "Delete All" on files uses a native `confirm()` dialog. A styled modal (like the chat clear confirmation) would be more consistent.

4. **Missing keyboard shortcuts** — No global shortcuts (e.g., `/` to focus search, `n` for new task). The sidebar shows a `/` hint but it's not functional as a global shortcut.

5. **No drag-and-drop reordering** — Tasks cannot be reordered manually; they're sorted by creation/filter only.

6. **Chat history sidebar is underutilized** — The left column shows "Chat History" but only displays a message count, not clickable conversation threads.

7. **No pagination** — All lists load all items at once. This will become a performance concern as data grows.

### Technical

8. **Duplicate CSS** — `index.css` contains duplicate definitions for buttons, form controls, filter pills, badges, progress bars, nav items, and scrollbars (lines 632–968 duplicate 632–776).

9. **No error boundary** — A React error boundary is missing. An unhandled error in any component will crash the entire app with a white screen.

10. **Native `confirm()` usage** — Tasks, Events, Places, Reminders, and Files all use `window.confirm()` for deletion, which is inconsistent with the polished UI and blocks the main thread.

11. **No offline support** — No service worker or PWA manifest. The app is completely non-functional without a network connection.

12. **Accessibility gaps** — Missing skip links, `aria-live` regions, focus traps, and proper `role="alert"` on errors.

---

## 17. Recommendations

### High Priority

| #   | Recommendation                                                          | Impact | Effort |
| --- | ----------------------------------------------------------------------- | ------ | ------ |
| 1   | **Add dark mode** with CSS custom properties and a toggle in the header | High   | Medium |
| 2   | **Replace native `confirm()` with a shared `ConfirmModal` component**   | Medium | Low    |
| 3   | **Add React Error Boundary** wrapping the app layout                    | High   | Low    |
| 4   | **Remove duplicate CSS** in `index.css` (lines ~792–968)                | Low    | Low    |
| 5   | **Add keyboard shortcuts** (`/` for search, `n` for new task)           | Medium | Medium |

### Medium Priority

| #   | Recommendation                                                                | Impact | Effort |
| --- | ----------------------------------------------------------------------------- | ------ | ------ |
| 6   | **Add pagination or virtualization** to Tasks, Files, and Notifications lists | Medium | Medium |
| 7   | **Implement clickable chat history threads** in the Chat page sidebar         | High   | Medium |
| 8   | **Add `aria-live` regions** for chat messages and toast notifications         | Medium | Low    |
| 9   | **Unify form styling** on Places page to use shared surface classes           | Low    | Low    |
| 10  | **Add optimistic updates** for task toggle and reminder actions               | Medium | Low    |

### Nice to Have

| #   | Recommendation                                                         | Impact | Effort |
| --- | ---------------------------------------------------------------------- | ------ | ------ |
| 11  | **Add PWA support** with service worker for offline resilience         | Medium | High   |
| 12  | **Add drag-and-drop reordering** for tasks                             | Medium | Medium |
| 13  | **Add data export** (CSV/JSON) for tasks, events, and places           | Medium | Low    |
| 14  | **Add onboarding tour** for first-time users highlighting key features | High   | Medium |
| 15  | **Add command palette** (Cmd+K) for quick navigation and actions       | High   | Medium |

---

## Appendix: File Inventory

| Category                  | Files                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entry**                 | `main.jsx`, `App.jsx`, `index.html`                                                                                                                                                          |
| **Pages (14)**            | `Dashboard`, `Tasks`, `Events`, `Places`, `Files`, `Reminders`, `Notifications`, `Search`, `Projects`, `Agents`, `Chat`, `Voice`, `ImageGenerator`, `Login`, `Register`                      |
| **Shared components (9)** | `Layout`, `Header`, `Sidebar`, `Card`, `MetricCard`, `QuickActions`, `ActivityList`, `TaskList`, `ProtectedRoute`                                                                            |
| **UI primitives (4)**     | `PageHeader`, `EmptyState`, `LoadingState`, `FilterPills`                                                                                                                                    |
| **Agent components (1)**  | `PipelineFlow`                                                                                                                                                                               |
| **Hooks (14)**            | `useAuth`, `useTasks`, `useEvents`, `usePlaces`, `useFiles`, `useReminders`, `useNotifications`, `useChat`, `useVoice`, `useAgents`, `useDashboard`, `useSearch`, `useProjects`, `useAlerts` |
| **Store (1)**             | `useAuth` (Zustand)                                                                                                                                                                          |
| **Styles (2)**            | `index.css` (1708 lines), `App.css` (185 lines)                                                                                                                                              |
