# YounesAI Mobile

Light-first, gesture-driven React Native client for the YounesAI platform.

## Modules

- **Tabs**: Home (bento dashboard), Tasks, Chat (center AI button), Inbox (AI email triage + approvals), More (module hub)
- **Stack screens**: Events, Reminders, Notifications, Places (geofences), Projects (+ detail), Files (semantic search), Image Studio (FLUX), Voice, Settings
- Navigation uses a floating glass tab bar (`src/components/navigation/FloatingTabBar.tsx`); the `FloatingAIHub` overlays every tab.

## Stack

- **Expo 57 / React Native 0.86 + Expo Router** — file-based routing
- **NativeWind v4** — Tailwind utility styling, light-first design tokens
- **TanStack Query v5 + MMKV** — cached server state with optimistic updates
- **Reanimated 4 + Gesture Handler** — UI-thread gesture physics
- **Expo Audio + Skia** — voice capture and GPU waveform shaders
- **expo-secure-store** — JWT persistence

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your backend
npm start
```

On a physical device, `EXPO_PUBLIC_API_URL` must be your machine's LAN IP
(e.g. `http://192.168.1.20:3001`), not `localhost`.

## Backend endpoints consumed

| Mobile feature             | Endpoint                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| Auth (login/register/me)   | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| Tasks CRUD + swipe archive | `GET/POST/PUT/DELETE /api/tasks`                                      |
| Dashboard events           | `GET /api/calendar_events`                                            |
| AI hub chat                | `POST /api/agents/chat`                                               |
| Voice commands             | `POST /api/agents/voice/process` (multipart `audio`)                  |
| Document search            | `GET /api/search?q=`                                                  |
| Place geofences            | `GET /api/places`, `POST /api/agents/place`                           |

## Notes

- Geofencing and MMKV require a development build (`npx expo run:android` or EAS);
  they no-op in Expo Go.
- The offline mutation queue lives in MMKV and flushes automatically when
  connectivity returns; manual retry is in Settings.
- Project conventions for AI agents are in `.cursor/rules/mobile-app.mdc`.
