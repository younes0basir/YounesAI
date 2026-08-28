# Gmail Setup Guide

This guide walks through connecting Gmail to the Personal AI Assistant (Stage C Email Intelligence).

## Prerequisites

- Backend running on `http://localhost:3000`
- Frontend running on `http://localhost:5173`
- PostgreSQL migrated (`npm run migrate` in `backend/`)
- **Email tables created** (`npm run migrate:email` in `backend/`) — required for Inbox and approvals
- Environment variables configured in `backend/.env`

## Required environment variables

```env
GOOGLE_GMAIL_CLIENT_ID=your_client_id
GOOGLE_GMAIL_CLIENT_SECRET=your_client_secret
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:3000/api/integrations/gmail/callback
OAUTH_TOKEN_ENCRYPTION_KEY=<64 hex chars>
FRONTEND_URL=http://localhost:5173

# AI classification (optional — uses NVIDIA_NIM_API_KEY if omitted)
NVIDIA_EMAIL_API_KEY=your_nim_key
NVIDIA_EMAIL_MODEL=meta/llama-3.1-8b-instruct
```

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Google Cloud Console setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Gmail API** (APIs & Services → Library)
4. Configure **OAuth consent screen** (External or Internal)
   - Add scopes:
     - `gmail.readonly`
     - `gmail.modify`
     - `gmail.labels`
     - `userinfo.email`
5. Create **OAuth 2.0 Client ID** (Web application)
   - Authorized redirect URI: `http://localhost:3000/api/integrations/gmail/callback`
6. Copy Client ID and Client Secret into `backend/.env`

## Connect Gmail in the app

1. Sign in to the app
2. Open **Settings → Integrations**
3. Click **Connect Gmail**
4. Complete Google OAuth consent
5. You are redirected back to Settings with a success toast
6. Open **Inbox** and click **Sync**

## Features

- **AI Inbox (default view)** — shows only **Important** and **Action Required** emails; newsletters, promotions, and spam are hidden
- Up to 2 Gmail accounts per user
- Incremental sync every 5 minutes (configurable via `GMAIL_SYNC_INTERVAL_MINUTES`)
- AI classification into 7 categories
- User rules + sender learning
- Batch actions require approval when selecting 2+ emails
- Email content treated as untrusted data (prompt injection defenses)

## Troubleshooting

| Issue                                                  | Fix                                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `Gmail OAuth is not configured`                        | Set `GOOGLE_GMAIL_*` env vars and restart backend                                             |
| `OAUTH_TOKEN_ENCRYPTION_KEY must be 64 hex characters` | Generate a 32-byte hex key                                                                    |
| `No refresh token received`                            | Revoke app in Google Account → Security → Third-party access, reconnect with `prompt=consent` |
| Empty inbox after sync                                 | Check sync status in Settings; verify Gmail API is enabled                                    |
| Empty AI Inbox after sync                              | Set `NVIDIA_EMAIL_API_KEY` in `backend/.env`, restart backend, sync again                     |
| Classification fails                                   | Set `NVIDIA_NIM_API_KEY` or `NVIDIA_EMAIL_API_KEY`                                            |

## API endpoints

| Method | Path                               | Description                 |
| ------ | ---------------------------------- | --------------------------- |
| GET    | `/api/integrations/gmail/connect`  | Start OAuth (auth required) |
| GET    | `/api/integrations/gmail/callback` | OAuth callback              |
| GET    | `/api/integrations/gmail/accounts` | List connected accounts     |
| POST   | `/api/integrations/gmail/sync/all` | Sync all accounts           |
| GET    | `/api/email`                       | List classified emails      |
| GET    | `/api/email/approvals/pending`     | Pending batch approvals     |
