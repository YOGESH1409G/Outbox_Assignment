import { randomUUID } from "crypto";
import { prisma } from "../db/prisma";
import { emailQueue } from "../queue/queue";

export interface ScheduleRequest {
  subject: string;
  body: string;
  senderId: string;
  recipients: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit?: number;
}

export interface ScheduleResult {
  campaignId: string;
  scheduledCount: number;
}

/**
 * Persists a Campaign + one ScheduledEmail per recipient (spaced `delayMs` apart
 * starting at `startTime`), then bulk-enqueues matching BullMQ delayed jobs.
 * jobId === scheduledEmail.id, so re-running this against an existing id is a no-op
 * (idempotent), and a crash between the DB write and the enqueue is caught by reconcile().
 */
export async function createCampaign(req: ScheduleRequest): Promise<ScheduleResult> {
  const campaign = await prisma.campaign.create({
    data: {
      subject: req.subject,
      body: req.body,
      senderId: req.senderId,
      startTime: req.startTime,
      delayMs: req.delayMs,
      hourlyLimit: req.hourlyLimit,
    },
  });

  const rows = req.recipients.map((toEmail, i) => ({
    id: randomUUID(),
    campaignId: campaign.id,
    senderId: req.senderId,
    toEmail,
    subject: req.subject,
    body: req.body,
    scheduledAt: new Date(req.startTime.getTime() + i * req.delayMs),
  }));

  await prisma.scheduledEmail.createMany({ data: rows });

  await emailQueue.addBulk(
    rows.map((row) => ({
      name: "send",
      data: { scheduledEmailId: row.id },
      opts: { jobId: row.id, delay: Math.max(0, row.scheduledAt.getTime() - Date.now()) },
    }))
  );

  return { campaignId: campaign.id, scheduledCount: rows.length };
}
