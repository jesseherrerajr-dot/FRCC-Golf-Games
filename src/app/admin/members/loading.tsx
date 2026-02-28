import Header from "@/components/header";
import { SkeletonLine, SkeletonTable } from "@/components/skeleton";

export default function MembersLoading() {
  return (
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-5xl">
          {/* Back link + header skeleton */}
          <SkeletonLine className="mb-4 h-4 w-32" />
          <SkeletonLine className="mb-2 h-8 w-48" />
          <SkeletonLine className="mb-6 h-4 w-64" />

          {/* Search bar skeleton */}
          <SkeletonLine className="mb-4 h-10 w-full rounded-lg" />

          {/* Filter chips skeleton */}
          <div className="mb-6 flex gap-2">
            <SkeletonLine className="h-8 w-16 rounded-full" />
            <SkeletonLine className="h-8 w-20 rounded-full" />
            <SkeletonLine className="h-8 w-24 rounded-full" />
            <SkeletonLine className="h-8 w-28 rounded-full" />
          </div>

          {/* Table skeleton */}
          <SkeletonTable rows={8} />
        </div>
      </main>
    </>
  );
}
