# Outbox Labs — Email Job Scheduler

Full-stack email scheduler (ReachInbox assignment). **Backend is implemented and verified; frontend is a follow-up phase.**

## What's built (backend)

- `POST /api/schedule` — schedule a batch of emails (one per recipient), persisted to Postgres and enqueued as BullMQ delayed jobs.
- `GET /api/emails/scheduled`, `GET /api/emails/sent` — dashboard-facing lists.
- `GET /api/senders` — the pool of seeded Ethereal test-SMTP "sender" accounts.
- BullMQ worker: configurable concurrency, a global minimum delay between sends, and Redis-backed hourly rate limits (global + per-sender) that **reschedule** overflow into the next hour window instead of dropping/failing jobs.
- Idempotent, restart-safe: `jobId === scheduledEmail.id` throughout, a DB status guard (`PENDING` → `PROCESSING` → `SENT`/`FAILED`) prevents double-sends, and a startup reconciliation sweep re-enqueues any `PENDING` row left without a live BullMQ job (e.g. a crash between the DB write and the Redis enqueue).

## Running the backend

```bash
docker compose up -d        # Postgres (5433) + Redis (6380) — non-default ports to avoid clashing with any local installs
cp .env.example backend/.env
cd backend
npm install
npm run prisma:migrate      # applies the schema
npm run dev                 # starts the API + BullMQ worker
```

On first boot the server seeds a few Ethereal (fake SMTP) sender accounts and persists their credentials in Postgres, so restarts reuse the same accounts instead of minting new ones. Ethereal rate-limits/pools account creation, so `SENDER_COUNT` (default 2) is intentionally modest — the seeder logs a warning rather than hanging if Ethereal won't hand out more.

Example request:

```bash
curl -X POST http://localhost:4000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Hello",
    "body": "Hi there",
    "senderId": "<id from GET /api/senders>",
    "recipients": ["a@example.com", "b@example.com"],
    "startTime": "2026-01-01T12:00:00.000Z",
    "delayMs": 2000
  }'
```

## Architecture

**Data model** (`backend/prisma/schema.prisma`): `Sender` (seeded Ethereal accounts), `Campaign` (one per Compose submission), `ScheduledEmail` (one row per recipient — the single source of truth behind both the Scheduled and Sent dashboard views, via its `status`).

**Scheduling**: `POST /api/schedule` computes each recipient's `scheduledAt = startTime + i*delayMs`, bulk-inserts the rows, and bulk-enqueues matching BullMQ delayed jobs (`backend/src/services/schedulerService.ts`).

**Concurrency & delay**: the BullMQ `Worker` is created with `concurrency = WORKER_CONCURRENCY` and `limiter = { max: 1, duration: MIN_DELAY_MS }`, which throttles job processing queue-wide — so even with several jobs running in parallel, no two sends happen closer together than `MIN_DELAY_MS` (`backend/src/queue/worker.ts`).

**Hourly rate limiting**: `backend/src/queue/rateLimiter.ts` uses a Redis Lua script to atomically check-and-increment a global counter and a per-sender counter for the current hour bucket (`MAX_EMAILS_PER_HOUR`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, both env-configurable, 0 = unlimited). This is safe across multiple worker processes since the check-and-increment is a single atomic Redis-side operation, not a read-then-write from Node. When a job would exceed either cap, the worker calls BullMQ's `job.moveToDelayed()` to push that *same* job (no new jobId) to the start of the next hour and throws `DelayedError` — BullMQ treats this as an intentional reschedule, not a failure, so the job is never dropped.

**Persistence & restart-survival**: Redis runs with `--appendonly yes` and a Docker volume, so delayed jobs survive a Redis container restart on their own. On top of that, `backend/src/queue/reconcile.ts` runs at boot (and on an interval) and re-enqueues any `PENDING`/stuck-`PROCESSING` `ScheduledEmail` row that has no live BullMQ job — covering the case where a DB write committed but the Redis enqueue never happened before a crash. Combined with the `jobId`-based dedup and the DB status guard in the worker, this was verified by: scheduling emails, killing the process mid-flight, restarting, and confirming they send exactly once at the right time (see verification notes below).

**Verified manually** (see plan/commit history for exact runs): normal send flow, hourly-limit reschedule-not-drop behavior, and restart-survival (including a hard case — flushing Redis entirely — which correctly falls back to the DB-driven reconciliation sweep).

## Environment variables

See [`.env.example`](.env.example) — all limits/delays (`WORKER_CONCURRENCY`, `MIN_DELAY_MS`, `MAX_EMAILS_PER_HOUR`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, `SENDER_COUNT`, `RECONCILE_INTERVAL_MS`) are env-driven, nothing is hardcoded.

## Not yet built

Frontend (Next.js + Tailwind + NextAuth Google OAuth dashboard matching the Figma), demo video, and final README polish — planned as a follow-up phase.
