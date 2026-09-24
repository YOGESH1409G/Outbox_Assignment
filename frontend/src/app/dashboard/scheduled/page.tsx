import { EmailTable } from "@/components/EmailTable";

export default function ScheduledPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Scheduled Emails</h1>
      <EmailTable kind="scheduled" />
    </div>
  );
}
