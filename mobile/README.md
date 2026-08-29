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

On a physical device, `EXPO_PUBLIC_API_URL` must be a reachable server URL
(e.g. `http://84.8.220.241:3000` or your LAN IP), not `localhost`.

EAS cloud builds do **not** upload gitignored `mobile/.env` — the URL is set in
`mobile/eas.json` under each profile's `env` block. Rebuild after changing it.

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

- **Expo Go** loads JS from your PC (`expo start`) — closing the PC stops the app shell.
  Login JWT persists via SecureStore; cache/offline queue now use AsyncStorage in Expo Go.
- **Standalone APK** (persists like a normal app, no PC): `.\scripts\build-mobile-apk.ps1`
  or `cd mobile && eas build --platform android --profile preview`. Install APK on phone;
  only Oracle backend (`EXPO_PUBLIC_API_URL`) must be running.
- Geofencing requires a standalone build; it no-ops in Expo Go.
- Project conventions for AI agents are in `.cursor/rules/mobile-app.mdc`.
