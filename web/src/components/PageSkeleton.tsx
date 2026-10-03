import { Skeleton } from "./ui";

export function PageSkeleton({ variant = "home" }: { variant?: "home" | "grid" | "list" }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-4" aria-busy="true" aria-label="Loading">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      {variant === "home" && (
        <>
          <Skeleton className="mb-4 h-48 w-full rounded-3xl" />
          <Skeleton className="mb-6 h-16 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        </>
      )}
      {variant === "grid" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      )}
      {variant === "list" && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}
