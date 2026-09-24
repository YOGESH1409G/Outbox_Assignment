import nodemailer from "nodemailer";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensures at least `env.senderCount` Ethereal test-SMTP accounts exist as Senders.
 * Credentials are persisted in Postgres so restarts reuse the same accounts
 * instead of minting new (and losing track of) Ethereal inboxes every boot.
 *
 * Ethereal's createTestAccount() is rate-limited per IP and can hand back the
 * *same* pooled account for calls made in quick succession, so we space calls
 * out and treat a duplicate email as "already have this one" rather than an error.
 */
export async function seedSenders(): Promise<void> {
  let existing = await prisma.sender.count();
  const target = env.senderCount;
  let attempts = 0;

  while (existing < target && attempts < target * 3) {
    attempts++;
    const account = await nodemailer.createTestAccount();

    const already = await prisma.sender.findUnique({ where: { email: account.user } });
    if (already) {
      console.log(`[senderSeed] Ethereal returned a pooled/duplicate account (${account.user}), retrying`);
      await sleep(1500);
      continue;
    }

    const sender = await prisma.sender.create({
      data: {
        name: `Sender ${existing + 1}`,
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
    });
    console.log(`[senderSeed] created sender ${sender.name} <${sender.email}>`);
    existing++;
    await sleep(1500);
  }

  if (existing < target) {
    console.warn(
      `[senderSeed] only seeded ${existing}/${target} senders after ${attempts} attempts ` +
        `(Ethereal kept returning pooled duplicates). Proceeding with ${existing} sender(s) — restart later to top up.`
    );
  }
}
