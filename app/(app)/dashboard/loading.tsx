// app/(app)/dashboard/loading.tsx — v7 POLISH
// Premium skeleton that matches the real dashboard layout exactly

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="skeleton h-7 w-52 rounded-lg mb-2" />
          <div className="skeleton h-4 w-36 rounded" />
        </div>
        <div className="skeleton h-9 w-28 rounded-xl" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cyber-card p-5" style={{ animationDelay: `${i * 55}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-4 w-4 rounded" />
            </div>
            <div className="skeleton h-7 w-14 rounded mb-1.5" />
            <div className="skeleton h-2.5 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 cyber-card p-5">
          <div className="skeleton h-4 w-28 rounded mb-4" />
          <div className="skeleton h-48 w-full rounded-lg" />
        </div>
        <div className="cyber-card p-5">
          <div className="skeleton h-4 w-24 rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-3/4 rounded mb-1.5" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="cyber-card p-5">
          <div className="skeleton h-4 w-24 rounded mb-4" />
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="cyber-card p-5">
          <div className="skeleton h-4 w-28 rounded mb-4" />
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
