import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-black/45">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-black/68">
        The requested page may have moved, expired, or no longer exists in the storefront index.
      </p>
      <Link href="/" className="mt-8 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white">
        Return home
      </Link>
    </div>
  );
}
