import type { EmailStatus } from "@/lib/types";

const STYLES: Record<EmailStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-200",
  SENT: "bg-brand-50 text-brand-700 ring-brand-100",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
