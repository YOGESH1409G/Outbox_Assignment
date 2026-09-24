import { redisConnection } from "./redisConnection";
import { env } from "../config/env";

const TTL_SECONDS = 65 * 60; // hour window + slack, so a stalled key still expires

/**
 * Atomically checks the global + per-sender hourly counters and increments both
 * only if neither would be exceeded. A limit of 0 means "unlimited" for that scope.
 * Safe across multiple worker processes since the check+increment happens in one
 * Redis-side Lua script (no read-then-write race between workers).
 */
const CHECK_AND_INCREMENT_LUA = `
local globalKey = KEYS[1]
local senderKey = KEYS[2]
local globalLimit = tonumber(ARGV[1])
local senderLimit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local globalCount = tonumber(redis.call('GET', globalKey) or '0')
local senderCount = tonumber(redis.call('GET', senderKey) or '0')

if globalLimit > 0 and globalCount >= globalLimit then
  return 0
end
if senderLimit > 0 and senderCount >= senderLimit then
  return 0
end

redis.call('INCR', globalKey)
redis.call('EXPIRE', globalKey, ttl)
redis.call('INCR', senderKey)
redis.call('EXPIRE', senderKey, ttl)
return 1
`;

/** Floors a date to its containing hour bucket, used as the Redis key suffix. */
export function hourBucket(date: Date): string {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function startOfNextHour(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  return d;
}

/**
 * Attempts to reserve one send slot for `senderId` in the hour bucket containing `at`.
 * Returns true (and reserves the slot) if under both the global and per-sender caps.
 */
export async function tryReserveSendSlot(senderId: string, at: Date): Promise<boolean> {
  const bucket = hourBucket(at);
  const globalKey = `rl:global:${bucket}`;
  const senderKey = `rl:sender:${senderId}:${bucket}`;

  const result = await redisConnection.eval(
    CHECK_AND_INCREMENT_LUA,
    2,
    globalKey,
    senderKey,
    String(env.maxEmailsPerHour),
    String(env.maxEmailsPerHourPerSender),
    String(TTL_SECONDS)
  );

  return result === 1;
}
