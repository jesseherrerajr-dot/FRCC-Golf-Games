import { SkeletonLine } from "@/components/skeleton";

export default function ProfileLoading() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* Back link + header skeleton */}
        <SkeletonLine className="mb-4 h-4 w-36" />
        <SkeletonLine className="mb-1 h-8 w-44" />
        <SkeletonLine className="mb-6 h-4 w-56" />

        {/* Form field skeletons */}
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <SkeletonLine className="mb-2 h-3 w-20" />
              <SkeletonLine className="h-12 w-full rounded-lg" />
            </div>
          ))}
          <SkeletonLine className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
