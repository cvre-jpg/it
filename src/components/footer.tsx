import { Link, useRouterState } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { CATEGORY_TREE } from "@/lib/category-tree";

const TRUSTED_DISTRIBUTORS = [
  { name: "hp", brandColor: "group-hover:text-[#0096D6]", markClassName: "text-lg font-bold" },
  { name: "Lenovo", brandColor: "group-hover:text-[#E2231A]", markClassName: "text-sm font-bold" },
  { name: "DELL", brandColor: "group-hover:text-[#0672CE]", markClassName: "text-sm font-bold" },
  { name: "SAMSUNG", brandColor: "group-hover:text-[#1428A0]", markClassName: "text-[11px] font-bold" },
  { name: "EPSON", brandColor: "group-hover:text-[#003399]", markClassName: "text-xs font-bold" },
  { name: "Canon", brandColor: "group-hover:text-[#CC0000]", markClassName: "text-base font-bold" },
  { name: "acer", brandColor: "group-hover:text-[#80C41C]", markClassName: "text-base font-bold" },
  { name: "Apple", brandColor: "group-hover:text-[#111111]", markClassName: "text-sm font-semibold" },
  { name: "Logitech", brandColor: "group-hover:text-[#00B8FC]", markClassName: "text-[11px] font-bold" },
] as const;

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.12v12.42a2.62 2.62 0 1 1-2.62-2.62c.23 0 .45.03.67.08V8.72a5.76 5.76 0 0 0-.67-.04A5.74 5.74 0 1 0 15.82 14V8.73a7.92 7.92 0 0 0 4.63 1.48V7.13c-.3 0-.59-.15-.86-.44Z" />
    </svg>
  );
}

export function Footer() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const findUsSpacingClass = /^\/products\/[^/]+$/.test(path) ? "mt-[20px]" : "mt-20";

  return (
    <>
      <section className={`${findUsSpacingClass} border-t bg-background`}>
        <div className="site-desktop-width mx-auto px-6 py-10">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Find Us</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Visit our location or open directions in Google Maps.
              </p>
            </div>
            <a
              href="https://maps.app.goo.gl/7A3d34gMimEMCx6u6"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Direction
            </a>
          </div>

          <a
            href="https://maps.app.goo.gl/7A3d34gMimEMCx6u6"
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-3xl border shadow-soft"
          >
            <iframe
              title="Shop ICT Gadgets location"
              src="https://www.google.com/maps?q=Laxmi%20Plaza%20Nairobi&z=16&output=embed"
              className="h-[360px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </a>
        </div>
      </section>

      <footer className="border-t bg-surface">
        <div className="site-desktop-width mx-auto grid gap-10 px-6 py-14 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Dealers in IT products, Electronics, Accessories, Phones, Homewear, Servers, Networking Accessories, etc.
            </p>
            <div className="mt-4 flex gap-2">
              {[
                { Icon: Facebook, href: "https://www.facebook.com/Shopictgadgets", label: "Facebook" },
                { Icon: Instagram, href: "https://www.instagram.com/jamesndiba_/", label: "Instagram" },
                { Icon: TikTokIcon, href: "https://www.tiktok.com/@shop.ict.gadgets", label: "TikTok" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border hover:bg-background"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Shop</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/shop">All Products</Link></li>
              {CATEGORY_TREE.map((category) => (
                <li key={category.label}>
                  <Link to="/shop" search={{ category: category.label } as any}>
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Reach Us</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> +254713869018</li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> ictgadgetsshop@gmail.com</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Nairobi, Kenya</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Trusted Distributor For</h4>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3" aria-label="Trusted distributor brands">
              {TRUSTED_DISTRIBUTORS.map(({ name, brandColor, markClassName }) => (
                <div
                  key={name}
                  className="group flex h-7 min-w-0 items-center justify-start"
                >
                  <span className={`${markClassName} text-[#9CA3AF] transition-colors duration-200 ${brandColor}`}>
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Shop ICT Gadgets. All rights reserved.
        </div>
      </footer>
    </>
  );
}
