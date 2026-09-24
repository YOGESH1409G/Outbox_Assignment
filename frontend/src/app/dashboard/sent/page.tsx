import { EmailTable } from "@/components/EmailTable";

export default function SentPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Sent Emails</h1>
      <EmailTable kind="sent" />
    </div>
  );
}
