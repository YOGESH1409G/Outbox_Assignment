# Outbox Labs — Email Job Scheduler

Full-stack email scheduler (ReachInbox assignment): Express + BullMQ + Redis + Postgres backend, Next.js + Tailwind + NextAuth (Google OAuth) frontend.

## Features implemented

**Backend**
- Scheduler: `POST /api/schedule` persists one row per recipient and enqueues matching BullMQ delayed jobs (no cron anywhere).
- Persistence & restart-survival: Redis AOF persistence + a DB-driven reconciliation sweep re-enqueues any row left without a live job after a crash/restart. Jobs are never duplicated or restarted from scratch.
- Concurrency: configurable BullMQ worker concurrency (`WORKER_CONCURRENCY`).
- Rate limiting: a queue-wide minimum delay between sends (`MIN_DELAY_MS`) plus Redis-backed hourly caps, global and per-sender (`MAX_EMAILS_PER_HOUR`, `MAX_EMAILS_PER_HOUR_PER_SENDER`). Overflow is rescheduled into the next hour window, never dropped or failed.
- Idempotency: `jobId === scheduledEmail.id` throughout, plus a DB status guard (`PENDING → PROCESSING → SENT/FAILED`).

**Frontend**
- Google OAuth login (NextAuth), header shows the signed-in user's name/email/avatar + logout.
- Dashboard shell (sidebar with live Scheduled/Sent counts, Compose button) matching the Figma layout.
- Compose New Email: subject/body, sender picker, CSV/text file upload with a live "N email addresses detected" count, start time, delay, hourly limit — submits to the real backend API.
- Scheduled and Sent tables with loading skeletons, empty states, and status badges.
- Basic error handling (inline banners on failed loads/submits).

## Running the backend

```bash
docker compose up -d        # Postgres (5433) + Redis (6380) — non-default ports to avoid clashing with any local installs
cp .env.example backend/.env
cd backend
npm install
npm run prisma:migrate      # applies the schema
npm run dev                 # starts the API + BullMQ worker on :4000
```

On first boot the server seeds a few Ethereal (fake SMTP) sender accounts and persists their credentials in Postgres, so restarts reuse the same accounts instead of minting new ones. Ethereal rate-limits/pools account creation, so `SENDER_COUNT` (default 2) is intentionally modest — the seeder logs a warning rather than hanging if Ethereal won't hand out more.

## Running the frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

### Setting up Google OAuth

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID of type **Web application**.
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
3. Put the client ID/secret into `frontend/.env.local` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.

Without real Google credentials the "Continue with Google" button will error (NextAuth has no client ID to redirect to) — everything else in the app works independently of this, since the dashboard only depends on there being a valid NextAuth session, not on which provider created it.

## Architecture

**Data model** (`backend/prisma/schema.prisma`): `Sender` (seeded Ethereal accounts), `Campaign` (one per Compose submission), `ScheduledEmail` (one row per recipient — the single source of truth behind both the Scheduled and Sent dashboard views, via its `status`).

**Scheduling**: `POST /api/schedule` computes each recipient's `scheduledAt = startTime + i*delayMs`, bulk-inserts the rows, and bulk-enqueues matching BullMQ delayed jobs (`backend/src/services/schedulerService.ts`).

**Concurrency & delay**: the BullMQ `Worker` is created with `concurrency = WORKER_CONCURRENCY` and `limiter = { max: 1, duration: MIN_DELAY_MS }`, which throttles job processing queue-wide — so even with several jobs running in parallel, no two sends happen closer together than `MIN_DELAY_MS` (`backend/src/queue/worker.ts`).

**Hourly rate limiting**: `backend/src/queue/rateLimiter.ts` uses a Redis Lua script to atomically check-and-increment a global counter and a per-sender counter for the current hour bucket (`MAX_EMAILS_PER_HOUR`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, both env-configurable, 0 = unlimited). This is safe across multiple worker processes since the check-and-increment is a single atomic Redis-side operation, not a read-then-write from Node. When a job would exceed either cap, the worker calls BullMQ's `job.moveToDelayed()` to push that *same* job (no new jobId) to the start of the next hour and throws `DelayedError` — BullMQ treats this as an intentional reschedule, not a failure, so the job is never dropped.

**Persistence & restart-survival**: Redis runs with `--appendonly yes` and a Docker volume, so delayed jobs survive a Redis container restart on their own. On top of that, `backend/src/queue/reconcile.ts` runs at boot (and on an interval) and re-enqueues any `PENDING`/stuck-`PROCESSING` `ScheduledEmail` row that has no live BullMQ job — covering the case where a DB write committed but the Redis enqueue never happened before a crash. Combined with the `jobId`-based dedup and the DB status guard in the worker, this was verified by scheduling emails, killing the process mid-flight, restarting, and confirming they send exactly once at the right time.

**Frontend**: Next.js App Router. `getServerSession` gates `/dashboard/*` (with `middleware.ts` as a second layer), and pages call the backend directly from the client via `NEXT_PUBLIC_API_URL` (CORS-enabled on the backend). A small React context (`DashboardContext`) coordinates the Compose modal and a refresh signal so the sidebar counts and tables update immediately after scheduling.

## Environment variables

- Backend: see [`.env.example`](.env.example) — all limits/delays (`WORKER_CONCURRENCY`, `MIN_DELAY_MS`, `MAX_EMAILS_PER_HOUR`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, `SENDER_COUNT`, `RECONCILE_INTERVAL_MS`) are env-driven, nothing is hardcoded.
- Frontend: see [`frontend/.env.local.example`](frontend/.env.local.example).

## Assumptions, shortcuts, trade-offs

- **Backend API is not auth-protected.** The frontend gates the dashboard behind a Google session, but `/api/*` itself doesn't verify a JWT — acceptable for this assignment's scope, called out here rather than silently skipped. A production version would verify a shared-secret/JWT on each backend request.
- **CSV/text parsing happens client-side** (regex-extract email addresses from the uploaded file's text), and the parsed array is sent as JSON — simpler than streaming multipart uploads to the backend, and it's what lets the UI show a live "N addresses detected" count before submitting.
- **Recipients are one flat list per Compose submission** (no per-recipient personalization beyond the shared subject/body), matching the spec's fields.
- **`SENDER_COUNT` defaults to 2**, not 3+, because Ethereal's test-account creation is rate-limited/pooled and unreliable past a couple of rapid calls; the seeder retries with backoff and logs a warning instead of hanging.
- **Two `npm audit` advisories remain** on `next@14.2.35` (an AVIF image-optimization RCE and a bundled `postcss` issue) whose fixes require the Next 16 major; this app doesn't use `next/image`, so that RCE surface is unused. Flagged rather than silently left.
- Postgres/Redis are mapped to non-default host ports (5433/6380) in `docker-compose.yml` because this dev machine already had native Postgres/Redis installs on the default ports.

## Not yet built

Demo video and a live deployment — the app has only been run and verified locally.
