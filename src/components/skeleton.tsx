/** Reusable skeleton primitives for loading states. */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}
      aria-hidden="true"
    >
      <SkeletonLine className="mb-3 h-4 w-3/4" />
      <SkeletonLine className="mb-2 h-3 w-1/2" />
      <SkeletonLine className="h-3 w-1/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" aria-hidden="true">
      {/* Header */}
      <div className="flex gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="hidden h-3 w-32 sm:block" />
        <SkeletonLine className="hidden h-3 w-20 md:block" />
        <SkeletonLine className="ml-auto h-3 w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0"
        >
          <SkeletonLine className="h-3 w-28" />
          <SkeletonLine className="hidden h-3 w-36 sm:block" />
          <SkeletonLine className="hidden h-3 w-20 md:block" />
          <SkeletonLine className="ml-auto h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
