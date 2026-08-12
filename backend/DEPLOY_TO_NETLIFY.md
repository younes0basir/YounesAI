# Deploying the Backend to Netlify

This backend is ready to deploy to Netlify as serverless functions, **alongside**
the Vercel setup (they share the same `src/app.js`). This guide covers deploying
only the `backend/` folder on Netlify.

## What was added for Netlify

| Concern | Vercel | Netlify |
|---|---|---|
| Function entry | `api/index.js` (Vercel auto-detects + `vercel.json`) | `netlify/functions/api.js` wrapped with `serverless-http` |
| Arrow config | `vercel.json` | `netlify.toml` |
| Background jobs | Vercel Cron → `POST /api/cron` | Netlify Scheduled Function → `netlify/functions/cron.js` |
| Database | `DATABASE_URL` (same) | same pool in `src/db.js` |
| Uploads | `os.tmpdir()` (same) | same `os.tmpdir()` |

Everything else (routers, env vars, migrations, upload dir) is shared — no
behavioral change between providers.

---

## 1. Provision a hosted Postgres

Same as Vercel: serverless can't reach `localhost:5432`. Use a hosted Postgres
(Vercel Postgres, Neon, Supabase, Railway) and grab its `DATABASE_URL`
connection string (e.g. `postgres://user:password@host:5432/db?sslmode=require`).

## 2. Run the schema migration

From the `backend/` folder:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgres://user:password@host:5432/db?sslmode=require"
node src/migrate.js
```

## 3. Deploy

### Option A — Netlify Dashboard

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import
   an existing project**, pick your repo.
2. **Base directory** must be **`backend`** — the `netlify.toml`, `netlify/`,
   and `package.json` all live there. Paths in `netlify.toml` are relative to
   that base.
3. Leave build command as-is (`command = "true"` — no build step is needed;
   the Express app is bundled as a function). Set:
   - **Publish directory**: `public` (from `netlify.toml`; contains a small
     placeholder page).
   - **Functions directory**: `netlify/functions` (from `netlify.toml`).
4. Add **Environment Variables** (same list as Vercel):

   | Variable | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | ✅ | Hosted Postgres connection string |
   | `JWT_SECRET` | ✅ | Long random string |
   | `CORS_ORIGIN` | ⚠️ | Comma-separated frontend origins |
   | `FRONTEND_URL` | ⚠️ | Frontend base URL (Gmail OAuth redirect target) |
   | `GROQ_API_KEY` | if using voice/chat | |
   | `OPENROUTER_API_KEY` | optional | Fallback provider |
   | `NVIDIA_*` keys | optional | NVIDIA agents / image gen |
   | `GOOGLE_GMAIL_CLIENT_ID` / `_SECRET` | ⚠️ | For Gmail integration |
   | `GOOGLE_GMAIL_REDIRECT_URI` | ⚠️ | Must be `https://<your>.netlify.app/api/integrations/gmail/callback` |
   | `OAUTH_TOKEN_ENCRYPTION_KEY` | ⚠️ | 64 hex chars |
   | `SHOW_AGENT_SOURCES` | optional | `true` shows sourcing lines |

   > **Security:** same rule as Vercel — real keys belong only in Netlify's
   > Environment Variables, never in a committed `.env` / `.env.example`.
   > `backend/.env` is gitignored and will not deploy.

5. **Deploy site**.

### Option B — Netlify CLI

```bash
# from backend/
npx netlify init        # link the site, set base dir to backend
npx netlify deploy --prod
```

Local preview with the full redirect/function config:

```bash
npm run netlify:dev     # = netlify dev
```

---

## 4. Scheduled functions (replacing node-cron)

`node-cron` needs a long-running process, so it can't run on serverless. The
same engines run via a **Netlify Scheduled Function**:
`netlify/functions/cron.js` (invoked internally by Netlify, not by HTTP).

It runs every exported engine, or a single one:

- all engines (default): `runReminderWarningEngine`, `runReminderEngine`,
  `runTaskDueNotificationEngine`, `runRecurringTaskEngine`,
  `runRecurringEventEngine`, `runOverdueTaskEngine`, `runGmailSyncEngine`
- one engine via query param, e.g. `?job=runGmailSyncEngine`

Set the cadence in `netlify.toml`:

```toml
[functions."cron"]
  schedule = "@daily"   # or a cron expr like "0 * * * *"
```

> ⚠️ **Plan limits:** Netlify Scheduled Functions honor your plan's minimum
> cadence. Free/Starter only allows limited daily schedules and ~10s execution;
> hourly/5-minutely expressions need a paid plan. The `[functions."cron"]`
> block is commented out in `netlify.toml` by default — uncomment and set a
> schedule you're entitled to. Also note each engine should finish well under
> Netlify's execution-time cap (see docs for current value).

## 5. Verifying the deploy

```bash
# Health (checks DB connectivity)
curl https://<your-site>.netlify.app/api/health

# Swagger docs
curl https://<your-site>.netlify.app/api/docs
```

`/api/*` requests are rewritten (force) to `/.netlify/functions/api`, so your
routes keep their exact `/api/...` shape on the public URL.

---

## Known limitations (same as Vercel)

- Uploaded files (multer → `os.tmpdir()`) are ephemeral per request; metadata
  is saved but bytes aren't retrievable later. For durable storage add Netlify
  Blobs or an S3 bucket.
- In-memory stores (rate limiter, memory-agent vector cache) reset on cold
  starts.
- Desktop features (`chokidar` folder watching, local file scanning) remain
  Electron-only.
- `googleapis` + `swagger-ui-express` require the `zisi` bundler (set in
  `netlify.toml`) — do not switch to `esbuild` or swagger/static assets and
  dynamic requires will break.

---

## Rollback

Local dev is unchanged: `npm run dev` still boots `src/index.js` with
`node-cron`, folder watchers, and local Postgres. Vercel and Netlify can be
deployed from the same codebase without conflict (`vercel.json` vs
`netlify.toml` are provider-specific).