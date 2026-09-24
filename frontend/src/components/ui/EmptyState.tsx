export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-200 py-16 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}
