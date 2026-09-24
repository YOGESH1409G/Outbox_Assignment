import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection";

export const EMAIL_QUEUE_NAME = "email-send";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});

/** Enqueue (or no-op if the jobId already exists) a delayed send for one scheduled email. */
export async function enqueueScheduledEmail(scheduledEmailId: string, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add(
    "send",
    { scheduledEmailId },
    { jobId: scheduledEmailId, delay }
  );
}
