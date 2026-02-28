import Header from "@/components/header";
import { SkeletonLine, SkeletonCard, SkeletonTable } from "@/components/skeleton";

export default function AdminLoading() {
  return (
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-5xl">
          {/* Header skeleton */}
          <SkeletonLine className="mb-2 h-8 w-56" />
          <SkeletonLine className="mb-6 h-4 w-72" />

          {/* Event cards skeleton */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <SkeletonCard className="h-36" />
            <SkeletonCard className="h-36" />
          </div>

          {/* Pending registrations skeleton */}
          <SkeletonLine className="mb-3 h-5 w-48" />
          <SkeletonTable rows={3} />

          {/* Quick links skeleton */}
          <SkeletonLine className="mb-3 mt-8 h-5 w-32" />
          <div className="flex gap-3">
            <SkeletonLine className="h-10 w-32 rounded-lg" />
            <SkeletonLine className="h-10 w-32 rounded-lg" />
            <SkeletonLine className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </main>
    </>
  );
}
