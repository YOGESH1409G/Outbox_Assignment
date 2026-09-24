import nodemailer, { Transporter } from "nodemailer";
import type { Sender } from "@prisma/client";

const transporterCache = new Map<string, Transporter>();

function transporterFor(sender: Sender): Transporter {
  let transporter = transporterCache.get(sender.id);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: false,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
    });
    transporterCache.set(sender.id, transporter);
  }
  return transporter;
}

export async function sendViaEthereal(
  sender: Sender,
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl: string | false }> {
  const transporter = transporterFor(sender);
  const info = await transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    text: body,
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}
