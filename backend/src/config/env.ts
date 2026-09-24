import "dotenv/config";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Invalid integer for env var ${name}: ${raw}`);
  return parsed;
}

export const env = {
  port: int("PORT", 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: int("REDIS_PORT", 6379),
  senderCount: int("SENDER_COUNT", 3),
  workerConcurrency: int("WORKER_CONCURRENCY", 5),
  minDelayMs: int("MIN_DELAY_MS", 2000),
  maxEmailsPerHour: int("MAX_EMAILS_PER_HOUR", 200),
  maxEmailsPerHourPerSender: int("MAX_EMAILS_PER_HOUR_PER_SENDER", 100),
  reconcileIntervalMs: int("RECONCILE_INTERVAL_MS", 60000),
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
