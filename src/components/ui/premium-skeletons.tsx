/**
 * Premium loading skeletons — identidade dourada/escura.
 * Substituem spinners genéricos por blocos pulsantes de baixa luminosidade.
 */
import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-surface-2/40 via-surface-3/60 to-surface-2/40 bg-[length:200%_100%]",
        className,
      )}
      style={{ animation: "shimmer 1.6s ease-in-out infinite" }}
    />
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/60 bg-surface-1 p-6"
        >
          <Block className="h-3 w-2/3" />
          <Block className="mt-4 h-7 w-1/2" />
          <Block className="mt-3 h-2 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1 p-6">
      <Block className="mb-4 h-4 w-1/3" />
      <Block className={cn("w-full", height)} />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1 p-6">
      <Block className="mb-5 h-4 w-1/4" />
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="flex-1 space-y-2">
              <Block className="h-3 w-1/3" />
              <Block className="h-2 w-1/4" />
            </div>
            <Block className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgendaListSkeleton() {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="w-20 space-y-1.5">
            <Block className="mx-auto h-5 w-12" />
            <Block className="mx-auto h-2 w-10" />
          </div>
          <div className="flex-1 space-y-2">
            <Block className="h-3 w-1/3" />
            <Block className="h-2 w-1/2" />
          </div>
          <Block className="h-6 w-20" />
          <Block className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
