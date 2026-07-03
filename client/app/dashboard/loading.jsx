export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse flex">
      <div className="w-64 bg-white border-r border-gray-200 p-4 space-y-3 hidden lg:block">
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-6" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-gray-100" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl border border-gray-100" />
      </div>
    </div>
  );
}
