export interface Sender {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type EmailStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export interface ScheduledEmailRow {
  id: string;
  toEmail: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
  sender: { name: string; email: string };
}

export interface EmailListResponse {
  items: ScheduledEmailRow[];
  total: number;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  senderId: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit?: number;
}

export interface ScheduleResponse {
  campaignId: string;
  scheduledCount: number;
}
