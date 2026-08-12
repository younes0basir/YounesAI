# Deploying the Backend to Vercel

This backend is ready to deploy to Vercel as a serverless Express app. The repo's
frontend is Electron + Vite (desktop-first), so this guide covers deploying **only
the `backend/` folder**.

## What was changed for Vercel

| Concern | Local | Vercel |
|---|---|---|
| App entry | `src/index.js` calls `app.listen()` | `api/index.js` exports `app` as a serverless function |
| Routers | mounted in `src/index.js` | extracted to `src/app.js` (shared by both) |
| Database | `DB_HOST/DB_USER/...` vars | `DATABASE_URL` connection string + SSL |
| Background jobs | `node-cron` via `startScheduler()` | `vercel.json` Crons → `POST /api/cron?job=...` |
| File uploads | `backend/uploads/` | OS temp dir (`os.tmpdir()`), writable on serverless |
| Desktop folder watchers | `chokidar` (Electron only) | not loaded on Vercel |

---

## 1. Provision a hosted Postgres

Vercel's serverless functions have no persistent filesystem and can't reach
`localhost:5432`. Use a hosted Postgres. Easiest options:

- **Vercel Postgres** (part of your Vercel account, Neon-powered) — gives you a
  `DATABASE_URL` like `postgres://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require`.
- **Neon** / **Supabase** / **Railway** — any standard Postgres connection string works.

Copy the connection string — you'll need it as `DATABASE_URL` below.

## 2. Run the schema migration against that database

From the `backend/` folder, point the pool at your hosted DB and run:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgres://user:password@host:5432/db?sslmode=require"
node src/migrate.js
```

The migrator reads `db.sql` and runs it in multi-pass mode (skips unavailable
extensions like `vector` automatically). Alternatively run it once locally against
the hosted DB before your first deploy.

## 3. Deploy

### Option A — Vercel Dashboard (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import your repo.
2. In **Framework Preset** pick **Other** (or let it auto-detect Express).
3. Set **Root Directory** to **`backend`** — everything (build, `vercel.json`,
   `api/`, `package.json`) lives there. The Electron/frontend folders are ignored.
4. Add the required environment variables:

   | Variable | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | ✅ | Hosted Postgres connection string |
   | `JWT_SECRET` | ✅ | Long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `CORS_ORIGIN` | ⚠️ | Comma-separated origins your frontend is served from |
   | `FRONTEND_URL` | ⚠️ | Base URL of your frontend (Gmail OAuth redirects return here) |
   | `GROQ_API_KEY` | if using voice/chat | |
   | `OPENROUTER_API_KEY` | optional | Fallback provider |
   | `NVIDIA_NIM_API_KEY` / per-agent keys | optional | NVIDIA agents |
   | `NVIDIA_IMAGE_API_KEY` | optional | Image generation |
   | `GOOGLE_GMAIL_CLIENT_ID` / `_SECRET` | ⚠️ | For Gmail integration |
   | `GOOGLE_GMAIL_REDIRECT_URI` | ⚠️ | Must be `https://<your-api-domain>/api/integrations/gmail/callback` |
   | `OAUTH_TOKEN_ENCRYPTION_KEY` | ⚠️ | 64 hex chars for encrypting stored tokens |
   | `SHOW_AGENT_SOURCES` | optional | `true` shows provider sourcing lines |

   > **Security:** `backend/.env` holds **real keys** (Groq, OpenRouter, NVIDIA,
   > Google). It is gitignored, so `.env.example` is what gets committed. **Never**
   > copy real keys into `.env.example`. Set them only in Vercel's dashboard
   > Environment Variables. Rotate any keys that already leaked into the repo.

5. Deploy.

### Option B — Vercel CLI

```bash
# from backend/
npx vercel pull --yes                              # logs you in + links project
npx vercel --prod                                  # production deploy
```

Local preview with the project config:

```bash
npm run vercel:dev    # = vercel dev (uses vercel.json + local env)
```

---

## 4. Cron jobs (replacing node-cron)

`node-cron` can't run on serverless (no long-lived process). Instead, the same
engines run via **Vercel Cron Jobs**, which hit the exported engines on demand:

`POST /api/cron?job={reminders|tasks|recurring|overdue|gmail|all}`

The existing `vercel.json` schedules:

| Job | Schedule | Schedule Exp |
|---|---|---|
| `reminders` | `* * * * *` | every minute |
| `tasks` | `*/15 * * * *` | every 15 min |
| `recurring` | `0 * * * *` | hourly |
| `overdue` | `0 8 * * *` | daily 08:00 UTC |
| `gmail` | `*/5 * * * *` | every 5 min |

> ⚠️ **Vercel Hobby plan**: Cron Jobs are limited to **one per day**. On the Hobby
> plan, run a single `all` job daily (or upgrade to Pro for sub-hourly schedules).
> Adjust the `crons` list in `vercel.json` accordingly.

---

## 5. Verifying the deploy

```bash
# Health (checks DB connectivity)
curl https://<your-api-domain>/api/health

# Swagger docs
curl https://<your-api-domain>/api/docs
```

If health returns `503`, the hosted database isn't reachable — double-check
`DATABASE_URL` and that the connection string allows external/SSL connections.

---

## Known limitations on serverless

- **Uploaded files are ephemeral.** `multer` writes to `/tmp`; the file exists only
  during the request that processed it. Metadata (name, size, etc.) is saved, but
  the byte content is not retrievable later. For persistent file storage, add
  **Vercel Blob** (`@vercel/blob`) or an S3-compatible bucket.
- **In-memory stores reset** on cold starts: `express-rate-limit` counters and the
  memory agent's vector cache start fresh per instance.
- **Desktop features don't run on Vercel**: `chokidar` folder watching and local
  file scanning remain Electron-only.
- **Streaming/long requests** have execution-time limits; AI calls should stay
  well under them.

---

## Rollback

Local dev is unchanged: `npm run dev` still boots `src/index.js` with `node-cron`,
folder watchers, and local Postgres. Nothing in this guide affects the Electron app.