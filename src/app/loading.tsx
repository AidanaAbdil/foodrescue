// Shown while a page loads (e.g. on a slow mobile connection): grey
// placeholder shapes in the layout of a bag list, instead of a frozen screen.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10" aria-busy="true">
      <div className="h-8 w-56 rounded-lg bg-stone-200" />
      <div className="mt-4 h-11 w-full rounded-lg bg-stone-200" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            <div className="aspect-[16/10] bg-stone-200" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-1/2 rounded bg-stone-200" />
              <div className="h-5 w-3/4 rounded bg-stone-200" />
              <div className="h-4 w-2/3 rounded bg-stone-200" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
