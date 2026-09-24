"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ScheduledEmailRow } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingRows } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useDashboard } from "@/components/DashboardContext";

type Kind = "scheduled" | "sent";

const COPY: Record<Kind, { timeLabel: string; timeField: keyof ScheduledEmailRow; empty: string; emptyDesc: string }> = {
  scheduled: {
    timeLabel: "Scheduled time",
    timeField: "scheduledAt",
    empty: "No scheduled emails",
    emptyDesc: "Compose a new email to schedule your first send.",
  },
  sent: {
    timeLabel: "Sent time",
    timeField: "sentAt",
    empty: "No sent emails yet",
    emptyDesc: "Emails will show up here once they've gone out.",
  },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailTable({ kind }: { kind: Kind }) {
  const { refreshSignal } = useDashboard();
  const [rows, setRows] = useState<ScheduledEmailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];

  const load = useCallback(() => {
    setError(null);
    const fetcher = kind === "scheduled" ? api.getScheduled : api.getSent;
    fetcher()
      .then((res) => setRows(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load emails"));
  }, [kind]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load, refreshSignal]);

  if (error) return <ErrorBanner message={error} />;
  if (rows === null) return <LoadingRows />;
  if (rows.length === 0) return <EmptyState title={copy.empty} description={copy.emptyDesc} />;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{copy.timeLabel}</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/60">
              <td className="px-4 py-3 text-gray-700">{row.toEmail}</td>
              <td className="max-w-xs truncate px-4 py-3 text-gray-700">{row.subject}</td>
              <td className="px-4 py-3 text-gray-500">{formatDate(row[copy.timeField] as string | null)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
