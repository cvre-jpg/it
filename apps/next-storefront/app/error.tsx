"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-black/45">Storefront error</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-black/68">{error.message || "Unexpected rendering failure."}</p>
      <button onClick={reset} className="mt-8 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white">
        Try again
      </button>
    </div>
  );
}
