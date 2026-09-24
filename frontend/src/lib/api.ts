import type { EmailListResponse, ScheduleRequest, ScheduleResponse, Sender } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getSenders: () => apiFetch<{ items: Sender[] }>("/api/senders"),
  getScheduled: () => apiFetch<EmailListResponse>("/api/emails/scheduled?limit=100"),
  getSent: () => apiFetch<EmailListResponse>("/api/emails/sent?limit=100"),
  schedule: (req: ScheduleRequest) =>
    apiFetch<ScheduleResponse>("/api/schedule", { method: "POST", body: JSON.stringify(req) }),
};
