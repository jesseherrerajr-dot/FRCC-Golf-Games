import { SkeletonLine, SkeletonTable } from "@/components/skeleton";

export default function RsvpLoading() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link + header skeleton */}
        <SkeletonLine className="mb-4 h-4 w-40" />
        <SkeletonLine className="mb-1 h-8 w-52" />
        <SkeletonLine className="mb-6 h-5 w-72" />

        {/* Capacity bar skeleton */}
        <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between">
            <SkeletonLine className="h-4 w-32" />
            <SkeletonLine className="h-4 w-16" />
          </div>
          <SkeletonLine className="mt-2 h-3 w-full rounded-full" />
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-3 text-center">
              <SkeletonLine className="mx-auto mb-2 h-7 w-8" />
              <SkeletonLine className="mx-auto h-3 w-14" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <SkeletonLine className="mb-3 mt-8 h-5 w-32" />
        <SkeletonTable rows={6} />
      </div>
    </main>
  );
}
