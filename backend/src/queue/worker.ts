import { Worker, Job, DelayedError } from "bullmq";
import { redisConnection } from "./redisConnection";
import { EMAIL_QUEUE_NAME } from "./queue";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { tryReserveSendSlot, startOfNextHour } from "./rateLimiter";
import { sendViaEthereal } from "../services/mailer";

interface EmailJobData {
  scheduledEmailId: string;
}

async function processJob(job: Job<EmailJobData>, token?: string): Promise<void> {
  const { scheduledEmailId } = job.data;

  const scheduledEmail = await prisma.scheduledEmail.findUnique({
    where: { id: scheduledEmailId },
    include: { sender: true },
  });

  if (!scheduledEmail) {
    console.warn(`[worker] scheduledEmail ${scheduledEmailId} not found, skipping`);
    return;
  }

  // Idempotency guard: only PENDING rows get sent. A job that fires twice
  // (stalled-job redelivery, duplicate enqueue) is a no-op the second time.
  if (scheduledEmail.status !== "PENDING") {
    console.log(`[worker] ${scheduledEmailId} already ${scheduledEmail.status}, skipping`);
    return;
  }

  await prisma.scheduledEmail.update({
    where: { id: scheduledEmailId },
    data: { status: "PROCESSING" },
  });

  const now = new Date();
  const allowed = await tryReserveSendSlot(scheduledEmail.senderId, now);

  if (!allowed) {
    // Hourly limit hit: move this same job back to the delayed set for the next
    // hour window instead of failing/dropping it. Keeps jobId === scheduledEmailId,
    // so there is never more than one live job per scheduled email.
    const nextWindow = startOfNextHour(now);
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: { status: "PENDING", scheduledAt: nextWindow },
    });
    await job.moveToDelayed(nextWindow.getTime(), token);
    console.log(`[worker] ${scheduledEmailId} hit hourly limit, rescheduled to ${nextWindow.toISOString()}`);
    throw new DelayedError();
  }

  try {
    const result = await sendViaEthereal(
      scheduledEmail.sender,
      scheduledEmail.toEmail,
      scheduledEmail.subject,
      scheduledEmail.body
    );
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
    });
    console.log(`[worker] sent ${scheduledEmailId} to ${scheduledEmail.toEmail} — preview: ${result.previewUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: { status: "FAILED", error: message, attempts: { increment: 1 } },
    });
    console.error(`[worker] failed to send ${scheduledEmailId}: ${message}`);
  }
}

export function startWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: env.workerConcurrency,
    limiter: { max: 1, duration: env.minDelayMs },
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed after retries: ${err.message}`);
  });

  return worker;
}
