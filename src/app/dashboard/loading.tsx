import { SkeletonLine, SkeletonCard } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header skeleton */}
        <SkeletonLine className="mb-2 h-8 w-48" />
        <SkeletonLine className="mb-8 h-4 w-64" />

        {/* Hero card skeleton */}
        <div className="animate-pulse rounded-lg border-2 border-gray-200 bg-white p-5 shadow-sm">
          <SkeletonLine className="mb-3 h-3 w-20" />
          <SkeletonLine className="mb-2 h-5 w-56" />
          <SkeletonLine className="mb-4 h-4 w-32" />
          <SkeletonLine className="h-10 w-full rounded-lg" />
        </div>

        {/* More upcoming skeleton */}
        <SkeletonLine className="mb-3 mt-8 h-5 w-36" />
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* My Events skeleton */}
        <SkeletonLine className="mb-3 mt-8 h-5 w-28" />
        <SkeletonCard />
      </div>
    </main>
  );
}
