"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { api } from "@/lib/api";
import type { Sender } from "@/lib/types";
import { useDashboard } from "@/components/DashboardContext";

const EMAIL_REGEX = /[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/g;

function defaultStartTime() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ComposeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { triggerRefresh } = useDashboard();

  const [senders, setSenders] = useState<Sender[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderId, setSenderId] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getSenders()
      .then((res) => {
        setSenders(res.items);
        if (res.items.length > 0) setSenderId(res.items[0].id);
      })
      .catch(() => setError("Could not load senders"));
  }, []);

  async function handleFile(file: File) {
    const text = await file.text();
    const found = Array.from(new Set(text.match(EMAIL_REGEX) ?? []));
    setRecipients(found);
    setFileName(file.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    if (!senderId) {
      setError("Select a sender.");
      return;
    }
    if (recipients.length === 0) {
      setError("Upload a CSV/text file with at least one email address.");
      return;
    }

    setSubmitting(true);
    try {
      await api.schedule({
        subject,
        body,
        senderId,
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayMs: Math.max(0, Math.round(delaySeconds * 1000)),
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
      });
      triggerRefresh();
      onClose();
      router.push("/dashboard/scheduled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule emails");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Compose New Email" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <Field label="Subject">
          <input
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Meeting follow-up"
          />
        </Field>

        <Field label="Body">
          <textarea
            className={`${inputClass} min-h-[96px] resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi there, just wanted to follow up..."
          />
        </Field>

        <Field label="From (sender)">
          <select className={inputClass} value={senderId} onChange={(e) => setSenderId(e.target.value)}>
            {senders.length === 0 && <option value="">Loading senders…</option>}
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Recipients (CSV or text file of emails)"
          hint={recipients.length > 0 ? `${recipients.length} email address(es) detected in ${fileName}` : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Start time">
            <input
              type="datetime-local"
              className={inputClass}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field label="Delay (seconds)">
            <input
              type="number"
              min={0}
              step={0.5}
              className={inputClass}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
            />
          </Field>
          <Field label="Hourly limit" hint="Blank = use default">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              placeholder="e.g. 100"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
