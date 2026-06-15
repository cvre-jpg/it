import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/categories/laptops", label: "Laptops" },
  { href: "/categories/monitors", label: "Monitors" },
  { href: "/brands", label: "Brands" },
  { href: "/blog", label: "Guides" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <Link href="/" className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-ink">
          Shop ICT Gadgets
        </Link>
        <nav className="hidden items-center gap-5 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-black/70 transition hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <form action="/search" className="w-full max-w-sm">
          <label className="sr-only" htmlFor="site-search">
            Search products
          </label>
          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f7f4] p-1">
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search products"
              className="h-10 w-full bg-transparent px-3 text-sm outline-none placeholder:text-black/35"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              Search
            </button>
          </div>
        </form>
      </div>
    </header>
  );
}
