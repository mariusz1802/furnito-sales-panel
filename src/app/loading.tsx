export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-48 rounded-lg bg-stone-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-2xl border border-line bg-surface lg:col-span-2" />
        <div className="h-72 rounded-2xl border border-line bg-surface" />
      </div>
    </div>
  );
}
