# YounesAI — Platform Views & UI Reference

> **Source of truth for every view, layout and UI primitive across Web + Mobile + Electron.**  
> Generated 2026-08-31 from `frontend/src/` (`frontend/src/App.jsx:22`) and `mobile/app/` (`mobile/app/_layout.tsx:1`).

---

## 1. Overview

| Layer                              | Entry                                                     | Routing                              | Styling                                                        |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| **Web** (Vite + React Router)      | `frontend/src/main.jsx:1` → `frontend/src/App.jsx:22`     | `react-router-dom` `<Routes>`        | Tailwind + `app-bg` / `surface` / `glass-header` CSS utilities |
| **Mobile** (Expo 57 + expo-router) | `mobile/app/_layout.tsx:1` → `PersistQueryClientProvider` | File-system routing (`app/(tabs)/*`) | NativeWind v4 + `mobile/tailwind.config.js:1` + `global.css:1` |
| **Desktop** (Electron)             | `electron/` mirrors mobile web                            | —                                    | —                                                              |

Shared domain: Tasks, Events, Reminders, Places, Projects, Files, Inbox, Chat/Voice/Image, Notifications, AI Studio, Search, Settings.

---

## 2. Design System

### 2.1 Tokens — Web

- **Layout shells** `frontend/src/components/Layout.jsx:10` — `glass-header sticky top-0 z-30` (`Header.jsx:58`), `sidebar-shell` (`fixed xl:sticky top-14`), `page-main`, `right-rail 2xl:block`.
- **Surfaces**: `surface`, `surface-elevated`, `rail-panel`, `app-bg` gradient.
- **Nav icons**: `nav-icon bg-violet-50 text-violet-600` etc. (`Sidebar.jsx:22`), `section-label`, `nav-item`, `nav-item-active`.

### 2.2 Tokens — Mobile (`mobile/tailwind.config.js:6`)

```js
canvas: { DEFAULT:'#F8F9FF', soft:'#EFF1FF' }, surface:'#FFFFFF',
ink: { DEFAULT:'#0F172A', soft:'#475569', muted:'#64748B', faint:'#94A3B8', ghost:'#CBD5E1' },
glass: { DEFAULT:'rgba(255,255,255,0.72)', strong:'rgba(255,255,255,0.92)', border:'rgba(148,163,184,0.18)' },
accent: { DEFAULT:'#6366F1', soft:'#EEF2FF', mint:'#10B981', amber:'#F59E0B', rose:'#F43F5E' },
borderRadius: { card:'20px', cardLg:'24px', pill:'9999px', sheet:'28px' },
boxShadow: { card:'0 8px 32px rgba(15,23,42,0.06)', fab:'0 10px 24px rgba(99,102,241,0.35)' }
```

- Typography: `hero 28/34 -0.02em 800`, `title 20/26 -0.01em 700`, `body 15/22`.

### 2.3 Primitives

| Primitive                                   | File                                                    | Appearance                                                                                | Behaviour                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GlassCard`                                 | `mobile/src/components/ui/GlassCard.tsx:1`              | `rounded-card border bg-white` (+ `elevated` shadow 18/8, `subtle` white/75)              | Solid surface (BlurView removed to fix Android inset bug). Used everywhere.                                                        |
| `ScreenHeader`                              | `mobile/src/components/ui/ScreenHeader.tsx:1`           | `BlurView 26` + `bg-white/55 border-b`, 22px extrabold title, 12px muted subtitle         | Back button `hapticsTap` + shadow, right slot                                                                                      |
| `FloatingTabBar`                            | `mobile/src/components/navigation/FloatingTabBar.tsx:1` | `bg-white/80` pill `intensity 72` shadow 28, center 52px gradient FAB `[#6366F1→#8B5CF6]` | Hides on keyboard, active dot, spring `damping 15 stiffness 120`                                                                   |
| `PressableScale`                            | `mobile/src/components/ui/PressableScale.tsx:1`         | —                                                                                         | Scale 0.96 on tap                                                                                                                  |
| `BottomSheet`                               | `mobile/src/components/ui/BottomSheet.tsx:1`            | `sheet 28px`, Gorhom                                                                      | `snapPoints ['32%','48%','55%']`                                                                                                   |
| `Skeleton` / `SkeletonCard` / `SkeletonRow` | `mobile/src/components/ui/Skeleton.tsx:1`               | `rounded-xl bg-slate-200` pulse 800ms                                                     | Placeholder for tasks/emails                                                                                                       |
| `BentoGrid` / `BentoSlot`                   | `mobile/src/components/bento/BentoGrid.tsx:1`           | `flex-row flex-wrap gap-y-3.5 px-4`, `w-[48.8%]/w-full`                                   | Bento layout                                                                                                                       |
| `BentoTaskCard`                             | `mobile/src/components/bento/BentoTaskCard.tsx:1`       | Left 1x rail rose/amber, `9x9` check, due pill `canvas-soft`, HIGH/MED pill               | Gestures: `Pan` right→archive, left→complete, `Tap` toggle                                                                         |
| `BentoEventCard`                            | `mobile/src/components/bento/BentoEventCard.tsx:1`      | Accent pill time, `TODAY` amber chip, 16px bold title, location pill                      | Tap scale 0.96                                                                                                                     |
| `FloatingAIHub` (Orb)                       | `mobile/src/components/ai/FloatingAIHub.tsx:63`         | `FAB 64` → sheet `328x252` `r 28`, `BlurView 56`, gradient `63→8B`, halos `OrbPulseRing`  | Draggable (snap left/right, persist `orbPosition.ts`), tap open, long-press `OrbQuickRing`, mic `SkiaWaveform`, `AgentStepTracker` |
| `AgentStepTracker`                          | `mobile/src/components/ai/AgentStepTracker.tsx:1`       | —                                                                                         | Shows orchestrator steps                                                                                                           |
| `SkiaWaveform`                              | `mobile/src/components/ai/SkiaWaveform.tsx:1`           | Skia shader                                                                               | Mic level                                                                                                                          |
| `TypeScript + haptics`                      | `mobile/src/lib/haptics.ts:1`                           | —                                                                                         | `hapticTap/Select/Success`                                                                                                         |
| Web `Card`/`MetricCard` etc                 | `frontend/src/components/Card.jsx:1`                    | `surface`, `surface-elevated`                                                             | —                                                                                                                                  |

---

## 3. Web — Chrome

### 3.1 `Layout` (`frontend/src/components/Layout.jsx:10`)

- Calls `usePendingAlerts()` (voice + badge).
- `Header` + `shell-layout` (left `sidebar-shell`, center `page-main animate-fade-up`, right `right-rail 2xl:block`).
- Mobile overlay `fixed inset-0 bg-slate-900/30 backdrop-blur` when `sidebarOpen`.

### 3.2 `Header` (`frontend/src/components/Header.jsx:57`)

- `glass-header h-14 max-w-[1560px]`: brand `AI` mark, title _Personal AI Assistant_, user display_name.
- Hidden on `xl`: Menu/X toggle.
- Right: `glass-search` (hidden `lg`) `Search tasks…` + `↵`, `Zap` → `/tasks`, `Bell` with `unread >9 ? 9+` badge (`Header.jsx:109`), backend switch (`BACKEND_MODES` local/cloud) `Server` icon + dropdown, user avatar + `user-menu` (Settings / Sign out). `Toaster` top-right.

### 3.3 `Sidebar` (`frontend/src/components/Sidebar.jsx:91`)

- Sections:
  - **Personal** (`Sidebar.jsx:21`): Home `/`, Inbox (badge `approvalCount`), Tasks, Calendar, Files, Projects, Places.
  - **AI** (`aiItems:37`): Assistant `/chat`, Voice, Image Studio, Reminders.
  - **AI Studio** (`studioItems:49`): AI Studio `/agents` with green/grey dot (`orchestratorActive`).
- Each `NavLink` → `nav-item` + `nav-icon` tint (`violet-50/emmerald-50/...`) + badge/dot + `haptic` via `navigate`.
- Bottom: `Ask AI anything…` → `/chat` (`kbd /`), `Notifications` + unread, `Settings`.
- Helper `NavItems` (`Sidebar.jsx:59`) maps tone/badges.

### 3.4 Right Rail (`Layout.jsx:48`)

- **Today** (`Calendar 14`): 5 today events, `w-1.5 h-8` color dot → `/events`.
- **Active reminders** (`Bell`): 5 unread `!is_read` → `/reminders`.
- **At a glance** (`Sparkles`): `mini-stat` Events / Reminders counts.

---

## 4. Web — Pages (`frontend/src/App.jsx:23`)

| Route              | File                                           | Layout Snapshot                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` Dashboard      | `frontend/src/pages/Dashboard.jsx:48`          | Hero `Greeting firstName` + date `EEE MMM do` + `Ask assistant` btn. Grid `StatPill` (Open tasks / Events today / Notifications / AI actions) `border slate-200/60 bg-white/70`. 3-col: Tasks ( `TaskList` 5, `View all →` ) + Today schedule ( `w-1 h-10` color bar ) + AI activity `AIStateCard`                                                                                                                                                                              |
| `/tasks`           | `frontend/src/pages/Tasks.jsx:42`              | `PageHeader Tasks` + New task toggle. Form `surface-elevated` (title/desc/details/checklist, `datetime-local`, recurrence, urgency/priority 1-5, Favorite star). `FilterPills` smart (`All/Today/Overdue/High`) + status (`All/Pending/In progress/Done`). Search via `?q` (`useLocation`). List `surface surface-interactive` with checkbox circle, favorite star, details/checklist 3, progress `progress-track`, badges `badge-*`, due red if overdue, `ConfirmModal` delete |
| `/reminders`       | `frontend/src/pages/Reminders.jsx:1`           | Similar `PageHeader` + `FilterPills`, snooze/dismiss via `useReminders`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/events`          | `frontend/src/pages/Events.jsx:1`              | Calendar list + `useEvents`, today filter                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/places`          | `frontend/src/pages/Places.jsx:1`              | Geofenced cards (`MapPin`, radius) + `syncGeofences`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/files`           | `frontend/src/pages/Files.jsx:1`               | File index (`useFiles`, `useIndexedFolders`), search, upload `files/index`/`register`                                                                                                                                                                                                                                                                                                                                                                                           |
| `/projects`        | `frontend/src/pages/Projects.jsx:1`            | Table `Distinct owner/member`, `FolderKanban`, members                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/inbox`           | `frontend/src/pages/Inbox.jsx:1`               | AI-triaged: `EMAIL_CATEGORIES` pills, approval cards `Sparkles`, email `Glass` list (from_name, category `CATEGORY_COLORS`, subject/snippet), `BottomSheet 55%` detail (Summarize/Important/Archive/Delete)                                                                                                                                                                                                                                                                     |
| `/chat`            | `frontend/src/pages/Chat.jsx:219`              | `h-[calc(100vh-7rem)]` two-pane: left `w-56` history (`Clear all` confirm), right `surface` chat. Empty `Bot 48` + suggestions 6. Messages: `User` `violet gradient` vs `Assistant` `white/80` bubbles, avatar `8x8 rounded-xl`, `MessageSteps` + `ChatImage` (`border slate-200/60`, retry/truncated, `Expand/Download`, fullscreen `fixed inset-0 bg-black/90`). Bottom: folder scope `Folder` selector + input + send `Loader/Send`                                          |
| `/voice`           | `frontend/src/pages/Voice.jsx:1`               | Wrapper around `useVoice`, mic `ensureMicPermission`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/image-generator` | `frontend/src/pages/ImageGenerator.jsx:1`      | `generateImage` FLUX (NVIDIA), prompt/width/height/steps/seed, `ChatImage` reuse                                                                                                                                                                                                                                                                                                                                                                                                |
| `/notifications`   | `frontend/src/pages/Notifications.jsx:1`       | Feed grouped by `read_at`, `type` labels, voice preview `Volume2`                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/search`          | `frontend/src/pages/Search.jsx:1`              | `q` param, `normalizeSearchResults`, tabs Tasks/Files/Places                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/agents`          | `frontend/src/pages/Agents.jsx:1`              | `ControlCenter` (NetworkGraph, AgentCapsules, IntelligencePanel, TimelineView, AnalyticsView, DebugView, CommandPalette)                                                                                                                                                                                                                                                                                                                                                        |
| `/settings`        | `frontend/src/pages/Settings.jsx:1`            | Account, backend `API_BASE_URL` test, toggles                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/auth/login`      | `frontend/src/pages/Login.jsx:1`               | `AppLogo`, email/password, `Welcome back`, biometric hint (web none)                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/auth/register`   | `frontend/src/pages/Register.jsx:1`            | Display name + email + password                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/agents` extras   | `frontend/src/components/control-center/*.jsx` | `AgentDetailPanel`, `WorkflowView`, `ConversationInspector`, `Background`                                                                                                                                                                                                                                                                                                                                                                                                       |

Shared web UI: `frontend/src/components/ui/PageHeader.jsx`, `FilterPills.jsx`, `AIStateCard.jsx`, `EmptyState.jsx`, `LoadingState.jsx`, `ErrorState.jsx`, `ConfirmModal.jsx`, `StatusBadge.jsx`.

---

## 5. Mobile — App Shell (`mobile/app/_layout.tsx:1`)

- `GestureHandlerRootView` + `BottomSheetModalProvider` + `PersistQueryClientProvider` (`PERSISTED_QUERY_KEY` from `mmkv.ts`, `hydrateMmkv`).
- `StatusBar dark`, `SplashScreen.preventAutoHide`.
- `AuthGate` (`_layout.tsx:27`): `hydrateMmkv` + `hydrate()` (biometric gate), redirects `(auth)/login` ↔ `(tabs)`.
- `VoiceAlertsWatcher` (`components/notifications/VoiceAlertsWatcher.tsx:1` → `useVoiceAlerts.ts`) + `FloatingAIHub` (`components/ai/FloatingAIHub.tsx:63`) mounted when `user` exists.
- `Stack` headers hidden; routes: `(auth)`, `(tabs)`, `+not-found`.

`_layout` for tabs (`mobile/app/(tabs)/_layout.tsx:1`) renders `FloatingTabBar` via `Tabs tabBar`.

Auth layouts (`mobile/app/(auth)/_layout.tsx:1`, `login.tsx:19`, `register.tsx:1`): `KeyboardAvoidingView`, `AppLogo 80 r28`, `FadeInDown`, biometric `Fingerprint/ScanFace` unlock, `API_BASE_URL` footer, `Link` to register.

---

## 6. Mobile — Tabs

### 6.1 Home — Dashboard `mobile/app/(tabs)/index.tsx:21`

- **Hero**: canvas blobs `accent-soft`/`indigo-50`, date pill `Sun/Sunrise/Moon` + avatar `Y` (`ink`), `hero` greeting `<Text accent>` + `openTasks/upcomingEvents` counts text.
- **Stats** `BentoGrid` 2x half `elevated` cards: Open tasks (`CheckCircle2` accent, `1x10 accent/20` line) / Upcoming (`CalendarClock` ink) counts `3xl extra-bold`.
- **Quick actions** `Ask AI` solid accent + `Tasks` outline → router.
- **Next up** header `11px 0.14em` + `View all →` → `/events`, cards `BentoEventCard`.
- **Priority tasks** header + `SkeletonCard` while loading, `BentoTaskCard` 5 with stagger `60-260ms`, empty `CheckCircle2` card, `>5 → View N more`.

### 6.2 Tasks `mobile/app/(tabs)/tasks.tsx:19`

- Header `11px/hero` “Your focus” + count, FAB `11x11 accent shadow 14`.
- Segment `mx-4 rounded-full bg-white p-1` (All/Today/Done) `bg-ink` active.
- `FlatList` `gap-3 pt-2 pb-40`, `SkeletonCard` 4, empty `✨` illustration filter-aware copy. `BentoTaskCard` with `onArchive/onToggleComplete`, pull refresh.

### 6.3 Chat — Assistant `mobile/app/(tabs)/chat.tsx:252`

- Header `YounesAI 11px` + `hero Assistant` + `Trash2` clear (calls `DELETE /api/agents/conversations`).
- `FlatList` `gap-3 pt-3 pb-6`, `FadeInDown` bubbles: user `bg-accent rounded-tr-md text-white`, assistant `bg-white border glass` + `MessageSteps` + `MobileChatImage` (`260` thumb, `Expand/Tap`, `Modal` fullscreen pinch-zoom, prompt footer) + `intent` pills `Sparkles` + timestamp.
- Empty: `Sparkles 14x14 accent-soft` + 6 suggestion chips `border g-white/80`, amber `Voice + Image` tip.
- Footer: `TypingIndicator`/`AgentStepTracker`/`SkiaWaveform level`, composer `rounded-[28] border bg-white shadow 18` (mic `accent/rose` + `TextInput` multiline + send `ink`/`slate-200`), `Groq Whisper · NVIDIA FLUX` caption, `pb-28` (keyboardVisible `pb-3`). Audio via `expo-audio` (`ensureMicPermission`, `recorder`).

### 6.4 Inbox `mobile/app/(tabs)/inbox.tsx:27`

- Header `Inbox 11px/hero`, triaged count badge `h-9 w-9 white border`.
- Segment `mx-4 rounded-full bg-white p-1` (first 5 `EMAIL_CATEGORIES`), `bg-ink` active.
- `FlatList` `gap-3 pt-1 pb-40`: `GlassCard elevated` if `!is_read`, avatar `9x9` initial `accent` vs `white`, from + category `12%` pill + dot, subject `15px`, snippet, date `short`. `ListHeader` approvals `Sparkles` cards with Approve `mint` / Reject `slate-200`. `BottomSheet 55%` detail (Summarize/Important/Archive/Delete).

### 6.5 More — Launcher `mobile/app/(tabs)/more.tsx:105`

- Profile `elevated` card `12x12 ink` avatar + `accent-soft` settings gear → `/settings`.
- Header `All modules 11px 0.14em` + `9 tools`.
- Grid `w-[48.8%] gap-y-3` of `GlassCard p-3.5 minH 122`: `9x9` tinted icon (`bg` + `border 18%`), 14px bold label `2 lines`, 11px description `2 lines`, no bottom bar. `PressableScale` + `FadeInDown 40ms`.

---

## 7. Mobile — Stack Screens (modals via `ScreenHeader`)

| Path             | File                              | UI                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/events`        | `mobile/app/events.tsx:1`         | `ScreenHeader Events` + `+` accent FAB → `BottomSheet 48%` (title/location/start `YYYY-MM-DD HH:mm`) `Create event`. `FlatList` sorted by `starts_at`, `BentoEventCard` + `Trash2 rose/10` delete, pull refresh                                                                                                                                                                                     |
| `/reminders`     | `mobile/app/reminders.tsx:1`      | Similar list `GlassCard`, swipe snooze/dismiss (`useReminders`)                                                                                                                                                                                                                                                                                                                                     |
| `/notifications` | `mobile/app/notifications.tsx:41` | `ScreenHeader Notifications` + `Mark all read` `bg-ink` shadow, `FlatList` `gap-3 pt-2 pb-12`: `GlassCard elevated` if unread (`10x10 accent` vs `white`), `Bell` icon, `10px` `typeTone` label, `15px` title, `13px` body, date `short`, speaker `Volume2` preview (`previewVoiceAlert`), empty `Bell 22` illustration                                                                             |
| `/places`        | `mobile/app/places.tsx:1`         | `MapPin` list `GlassCard`, `syncGeofences` → `Location`                                                                                                                                                                                                                                                                                                                                             |
| `/projects`      | `mobile/app/projects.tsx:1`       | `FolderKanban` grid, `useProjects`, `ScreenHeader`                                                                                                                                                                                                                                                                                                                                                  |
| `/project/[id]`  | `mobile/app/project/[id].tsx:1`   | `useProject(id)`, detail `GlassCard`, members                                                                                                                                                                                                                                                                                                                                                       |
| `/files`         | `mobile/app/files.tsx:1`          | File list `useSearch`, `BentoGrid`                                                                                                                                                                                                                                                                                                                                                                  |
| `/image-studio`  | `mobile/app/image-studio.tsx:1`   | FLUX prompt input + `MobileChatImage` preview                                                                                                                                                                                                                                                                                                                                                       |
| `/voice`         | `mobile/app/voice.tsx:1`          | `SkiaWaveform`, `ensureMicPermission`, `FloatingAIHub` voice path                                                                                                                                                                                                                                                                                                                                   |
| `/settings`      | `mobile/app/settings.tsx:25`      | `ScreenHeader Settings` subtitle `Account·Privacy·Sync`, `elevated` profile (`12x12 ink`, green dot), sections `GlassCard p-4`: Biometric (`Fingerprint/ScanFace` `Switch` `accent`), Voice alerts (`Volume2` `Switch`), Backend (`API_BASE_URL` + badge `Connected/Checking/Unreachable` + `Retest` `bg-ink`), Offline queue (`RefreshCw`), Places (`MapPin Enable`), Sign out `roseSoft` + shadow |
| `+not-found`     | `mobile/app/+not-found.tsx:1`     | Center `Link` back                                                                                                                                                                                                                                                                                                                                                                                  |

---

## 8. Cross-Cutting UI Behaviours

- **Haptics** `mobile/src/lib/haptics.ts:1` — `select` on tab, `tap` on back/center, `success` on send/archive.
- **Keyboard** `useKeyboardVisible` — tab bar hides, FAB lifts `-260`, composer reduces `pb-28→3`.
- **Offline** `mobile/src/services/offlineQueue.ts:1` — queued mutations `offline-mutation-queue`, `NetInfo` flush, banner counts.
- **Voice alerts** `mobile/src/services/notificationVoice.ts:1` — lazy `expo-notifications` (Expo Go guard), `voiceAlertsEnabled` mmkv, `speakAlert` via `expo-speech`, `playDueRing` double haptic, `presentNotificationAlert` channel `alerts` (Android), `max 2 per poll` + `2h recency` + cooldown 10s.
- **Biometrics** `mobile/src/services/biometrics.ts:1` — `expo-local-authentication` `Fingerprint/Face/Iris`, `ENABLED_KEY` mmkv, `authenticate` prompt.
- **Geofence** `mobile/src/services/geofence.ts:1` — `TaskManager` `younesai-geofence-sync`, `pushLocationContext` balance.
- **Animations** — `react-native-reanimated` `FadeInDown 40-340ms`, `withSpring damping 15-18 stiffness 120-180`, `withTiming 180-220ms`.
- **Empty/Loading/Error** — web `EmptyState`/`LoadingState`/`ErrorState` (`components/ui/*`), mobile `SkeletonCard` + `View 14x14 border` illustrations.

---

## 9. Navigation Map

```
Web:  / (Dashboard) ─┬─ /tasks ─ /reminders ─ /events ─ /places ─ /files ─ /projects ─ /agents (ControlCenter)
      /chat ─ /voice ─ /image-generator ─ /inbox ─ /search ─ /notifications ─ /settings
      /auth/login ─ /auth/register (ProtectedRoute → Layout)
Mobile: (tabs) ─┬─ index (Home) ─ tasks ─ chat ─ inbox ─ more [→ events/reminders/notifications/places/projects/files/image-studio/voice/settings/project/[id]]
                └─ (auth) login ─ register
                + FloatingAIHub (orb) over all tabs
```

---

_Maintain this file alongside `mobile/src/components/ui/*` and `frontend/src/components/*`. Any new view must add its route, file path, and a 2-line UI snapshot here._
