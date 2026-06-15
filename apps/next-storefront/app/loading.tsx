export default function LoadingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-10 w-56 animate-pulse rounded-full bg-black/5" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-4 shadow-soft">
            <div className="aspect-square animate-pulse rounded-[20px] bg-black/5" />
            <div className="mt-4 h-4 w-20 animate-pulse rounded-full bg-black/5" />
            <div className="mt-3 h-6 w-full animate-pulse rounded-full bg-black/5" />
            <div className="mt-3 h-6 w-32 animate-pulse rounded-full bg-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
