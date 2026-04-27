// app/(app)/models/loading.tsx — skeleton loader
export default function Loading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="skeleton h-7 w-48 rounded-lg mb-2" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className="cyber-card p-5" style={{animationDelay: `${i*55}ms`}}>
            <div className="skeleton h-4 w-3/4 rounded mb-3" />
            <div className="skeleton h-20 w-full rounded-lg mb-2" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
