import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <h2 className="text-lg font-semibold text-ink">Shop ICT Gadgets</h2>
          <p className="mt-3 text-sm leading-6 text-black/70">
            Fast, SEO-first eCommerce architecture for laptops, monitors, phones, and business electronics.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-black/50">Shop</h3>
          <ul className="mt-4 space-y-3 text-sm text-black/70">
            <li><Link href="/categories/laptops">Laptops</Link></li>
            <li><Link href="/categories/monitors">Monitors</Link></li>
            <li><Link href="/brands">Brands</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-black/50">Content</h3>
          <ul className="mt-4 space-y-3 text-sm text-black/70">
            <li><Link href="/blog">Buyer guides</Link></li>
            <li><Link href="/search?q=gaming">Trending products</Link></li>
            <li><Link href="/search?q=office">Office setups</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-black/50">Support</h3>
          <ul className="mt-4 space-y-3 text-sm text-black/70">
            <li><a href="mailto:hello@shopictgadgets.co.ke">hello@shopictgadgets.co.ke</a></li>
            <li><a href="tel:+254700000000">+254 700 000 000</a></li>
            <li><Link href="/robots.txt">Robots</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
