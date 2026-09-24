import { prisma } from "../db/prisma";
import { emailQueue, enqueueScheduledEmail } from "./queue";

/**
 * Startup (and periodic) safety net: finds ScheduledEmail rows that are PENDING
 * or stuck PROCESSING (from a crash mid-send) but have no live BullMQ job, and
 * re-enqueues them. Covers the gap where a DB write committed but the matching
 * queue.add()/addBulk() call never reached Redis before the process died.
 *
 * jobId === scheduledEmailId throughout, so enqueueScheduledEmail() is a safe
 * no-op if a live job already exists for that id.
 */
export async function reconcile(): Promise<number> {
  const candidates = await prisma.scheduledEmail.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, scheduledAt: true, status: true },
  });

  let recovered = 0;
  for (const row of candidates) {
    const existingJob = await emailQueue.getJob(row.id);
    const isLive = existingJob && !(await existingJob.isCompleted()) && !(await existingJob.isFailed());
    if (isLive) continue;

    if (row.status === "PROCESSING") {
      // Crashed mid-send with no live job left behind — safest is to retry it,
      // not assume it was sent (Ethereal sends are not itself idempotency-checked).
      await prisma.scheduledEmail.update({ where: { id: row.id }, data: { status: "PENDING" } });
    }
    await enqueueScheduledEmail(row.id, row.scheduledAt);
    recovered++;
  }

  if (recovered > 0) {
    console.log(`[reconcile] re-enqueued ${recovered} scheduled email(s) missing a live job`);
  }
  return recovered;
}
