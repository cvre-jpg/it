import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_TREE, type CategoryGroup } from "@/lib/category-tree";

const NAV = CATEGORY_TREE;

function buildMegaColumns(
  item: CategoryGroup,
): Array<{ heading: string; items: Array<{ label: string; badge?: { label: string; tone: "dark" | "red" } }> }> {
  const submenuItems = item.items.map((label) => ({ label }));
  const groups = [
    { heading: item.label, items: submenuItems.slice(0, 3) },
    { heading: item.label, items: submenuItems.slice(3, 6) },
    { heading: item.label, items: submenuItems.slice(6, 8) },
  ];

  return groups.map((group) => ({
    heading: group.heading,
    items: group.items.length > 0 ? group.items : [{ label: item.label }],
  }));
}

export function Header() {
  const { cartCount, wishlist } = useStore();
  const wishlistCount = wishlist.length;
  const [scrolled, setScrolled] = useState(false);
  const [desktopNavPinned, setDesktopNavPinned] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpenMenu, setMobileOpenMenu] = useState<string | null>(null);
  const [desktopOpenMenu, setDesktopOpenMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const routeSearch = useRouterState({ select: (state) => state.location.search as Record<string, string | undefined> });
  const searchPlaceholders = ["Laptops", "Printers", "Monitors", "Smartphones", "Accessories", "Audio"];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const adminShortcutTimerRef = useRef<number | null>(null);
  const adminShortcutTriggeredRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setDesktopNavPinned(window.innerWidth >= 1024 && window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % searchPlaceholders.length);
    }, 2200);

    return () => window.clearInterval(interval);
  }, [searchPlaceholders.length]);

  useEffect(() => {
    return () => {
      if (adminShortcutTimerRef.current !== null) {
        window.clearTimeout(adminShortcutTimerRef.current);
      }
    };
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: search } as any });
  };

  const clearAdminShortcutTimer = () => {
    if (typeof window === "undefined") return;

    if (adminShortcutTimerRef.current !== null) {
      window.clearTimeout(adminShortcutTimerRef.current);
      adminShortcutTimerRef.current = null;
    }
  };

  const startAdminShortcutPress = (_event: ReactPointerEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;

    clearAdminShortcutTimer();
    adminShortcutTriggeredRef.current = false;
    adminShortcutTimerRef.current = window.setTimeout(() => {
      adminShortcutTimerRef.current = null;
      adminShortcutTriggeredRef.current = true;
      setOpen(false);
      navigate({ to: "/auth" });
    }, 3000);
  };

  const cancelAdminShortcutPress = () => {
    if (adminShortcutTriggeredRef.current) return;
    clearAdminShortcutTimer();
  };

  const handleHeaderLogoClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (adminShortcutTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      adminShortcutTriggeredRef.current = false;
    }
  };

  const handleDrawerLogoClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (adminShortcutTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      adminShortcutTriggeredRef.current = false;
      return;
    }

    setOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-[#eeeeee] bg-white transition-shadow",
        open && "z-[70]",
        scrolled && "shadow-[0_10px_35px_-20px_rgba(17,24,39,0.28)] lg:shadow-none",
      )}
    >
      {desktopNavPinned ? <div className="hidden h-[148px] lg:block" aria-hidden="true" /> : null}

      <div
        className={cn(
          "hidden h-[66px] border-b border-[#eeeeee] bg-[#f4f4f4] lg:block",
          desktopNavPinned && "fixed left-0 right-0 top-0 z-50",
        )}
      >
        <div className="site-desktop-width mx-auto flex h-full w-full items-center gap-4 px-10 text-[13px] text-[#111827]">
          <div className="flex min-w-0 items-center gap-4">
            <a href="tel:+254713869018" className="whitespace-nowrap font-medium hover:text-[#ef2b10]">
              +254713869018
            </a>
            <span className="h-4 w-px bg-[#d9d9d9]" aria-hidden="true" />
            <span className="truncate">Nairobi, Laxmi Plaza, 3rd Flr, Room No 5</span>
          </div>
          <p className="ml-auto whitespace-nowrap text-sm font-medium text-[#111827]">
            Open Mon-Sat 8am-6pm
          </p>
        </div>
      </div>

      <div
        className={cn(
          "hidden h-[130px] bg-white lg:block",
          desktopNavPinned && "lg:hidden",
        )}
      >
        <div className="site-desktop-width mx-auto flex h-full w-full items-center gap-10 px-10">
          <Link to="/" className="min-w-[220px] text-[#111827]">
            <img src="/logo.png" alt="Shop ICT Kenya" className="h-16 w-auto object-contain" />
          </Link>

          <form onSubmit={onSearch} className="mx-auto flex w-full max-w-[560px]">
            <div className="flex h-[52px] w-full items-center rounded-[4px] border border-[#eeeeee] bg-white pl-5 pr-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search our store"
                className="h-full flex-1 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
              />
              <button
                type="submit"
                className="grid h-10 w-10 place-items-center rounded-[4px] text-[#ef2b10]"
                aria-label="Search"
              >
                <Search className="h-5 w-5" strokeWidth={1.9} />
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-3 text-[#111827]">
            <Link
              to="/wishlist"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" strokeWidth={1.8} />
              <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef2b10] px-1 text-[10px] font-semibold text-white">
                {wishlistCount}
              </span>
            </Link>
            <Link
              to="/cart"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.8} />
              <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef2b10] px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "hidden h-[82px] border-t border-[#eeeeee] bg-white lg:block",
          desktopNavPinned && "fixed left-0 right-0 top-[66px] z-50 shadow-[0_10px_35px_-20px_rgba(17,24,39,0.28)]",
        )}
      >
        <div
          className="site-desktop-width relative mx-auto flex h-full w-full items-center px-10"
          onMouseLeave={() => setDesktopOpenMenu(null)}
        >
          {desktopNavPinned ? (
            <Link to="/" className="mr-8 shrink-0 text-[#111827]">
              <img src="/logo.png" alt="Shop ICT Kenya" className="h-11 w-auto object-contain" />
            </Link>
          ) : null}

          <nav className="mx-auto flex items-center gap-10">
            {NAV.map((item, index) => (
              <div key={item.label} onMouseEnter={() => setDesktopOpenMenu(item.label)}>
                <Link
                  to="/shop"
                  search={{ category: item.label } as any}
                  className="relative inline-flex h-[82px] items-center gap-2 text-[15px] font-medium text-[#111827] transition-colors hover:text-[#ef2b10]"
                >
                  <span>{item.label}</span>
                  <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
                </Link>

                <div
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-full z-50 h-[200px] w-[1120px] -translate-x-1/2 rounded-[4px] bg-white px-[30px] pb-0 pt-[20px] opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-300",
                    desktopOpenMenu === item.label && "pointer-events-auto translate-y-0 opacity-100",
                    desktopOpenMenu !== item.label && "translate-y-4",
                  )}
                  onMouseEnter={() => setDesktopOpenMenu(item.label)}
                >
                  <div className="grid h-full grid-cols-3 gap-10">
                    {buildMegaColumns(item).map((column) => (
                      <div key={column.heading} className="flex flex-col">
                        <div className="space-y-[18px] pt-1">
                          {column.items.map((menuItem) => (
                            <Link
                              key={menuItem.label}
                              to="/shop"
                              search={{ category: item.label, subcategory: menuItem.label } as any}
                              className="flex items-center gap-2 text-[17px] text-[#777777] transition-colors hover:text-[#ef2b10]"
                            >
                              <span>{menuItem.label}</span>
                              {menuItem.badge ? (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white",
                                    menuItem.badge.tone === "dark" ? "bg-black" : "bg-[#ef2b10]",
                                  )}
                                >
                                  {menuItem.badge.label}
                                </span>
                              ) : null}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>

          {desktopNavPinned ? (
            <div className="ml-8 flex shrink-0 items-center gap-3 text-[#111827]">
              <Link
                to="/wishlist"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" strokeWidth={1.8} />
                <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef2b10] px-1 text-[10px] font-semibold text-white">
                  {wishlistCount}
                </span>
              </Link>
              <Link
                to="/cart"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
                aria-label="Cart"
              >
                <ShoppingBag className="h-5 w-5" strokeWidth={1.8} />
                <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef2b10] px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="lg:hidden">
        <div className="flex h-[28px] items-center overflow-hidden border-b border-[#eeeeee] bg-[#f8f8f8]">
          <div className="mobile-location-marquee whitespace-nowrap px-4 text-[11px] font-medium text-[#4b5563]">
            Nairobi, Laxmi Plaza, 3rd Flr, Room No 5 | +254713869018
          </div>
        </div>
        <div className="mx-auto grid h-[84px] w-full max-w-[1270px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            className="justify-self-start text-[#111827]"
            onClick={handleHeaderLogoClick}
            onPointerDown={startAdminShortcutPress}
            onPointerUp={cancelAdminShortcutPress}
            onPointerLeave={cancelAdminShortcutPress}
            onPointerCancel={cancelAdminShortcutPress}
          >
            <img src="/logo.png" alt="Shop ICT Kenya" className="h-11 w-auto object-contain" />
          </Link>

          <form onSubmit={onSearch} className="mx-auto min-w-0 w-full max-w-[180px] sm:max-w-[220px]">
            <div className="flex h-10 items-center rounded-full border border-[#eeeeee] bg-white pl-3 pr-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${searchPlaceholders[placeholderIndex]}`}
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
              />
              <button
                type="submit"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#ef2b10]"
                aria-label="Search"
              >
                <Search className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
          </form>

          <div className="justify-self-end text-[#111827]">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
              onClick={() => setOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-[86vw] max-w-sm overflow-y-auto bg-white px-6 pb-8 pt-6 shadow-[0_24px_60px_-24px_rgba(17,24,39,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md"
                onClick={handleDrawerLogoClick}
                onPointerDown={startAdminShortcutPress}
                onPointerUp={cancelAdminShortcutPress}
                onPointerLeave={cancelAdminShortcutPress}
                onPointerCancel={cancelAdminShortcutPress}
              >
                <img src="/logo.png" alt="Shop ICT Kenya" className="h-12 w-auto object-contain" />
              </button>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f5f5f5]"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5 text-[#111827]" strokeWidth={1.9} />
              </button>
            </div>

            <div className="overflow-hidden rounded-[3px] border border-[#dddddd] bg-white">
              <div className="border-b border-[#dddddd] bg-[#f7f7f7] px-4 py-3">
                <h2 className="text-sm font-bold text-[#222222]">Categories</h2>
              </div>

              <nav>
              {NAV.map((item) => (
                <div key={item.label}>
                  <div className="border-b border-[#dddddd]">
                    {(() => {
                      const isActiveCategory = routeSearch.category === item.label;
                      const isOpen = mobileOpenMenu === item.label;
                      return (
                    <button
                      type="button"
                      onClick={() =>
                        setMobileOpenMenu((current) => (current === item.label ? null : item.label))
                      }
                      className={cn(
                        "flex h-[38px] w-full items-center justify-between px-3 text-left text-sm font-medium transition-colors",
                        isActiveCategory || isOpen
                          ? "bg-[#e92d48] text-white"
                          : "text-[#4b5563] hover:bg-[#fafafa]",
                      )}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          isOpen && "rotate-180",
                        )}
                        strokeWidth={1.8}
                      />
                    </button>
                      );
                    })()}

                    <div
                      className={cn(
                        "grid overflow-hidden transition-all duration-300",
                        mobileOpenMenu === item.label
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="min-h-0 bg-white">
                        <div>
                          {item.items.map((subLabel) => (
                            <Link
                              key={subLabel}
                              to="/shop"
                              search={{ category: item.label, subcategory: subLabel } as any}
                              onClick={() => setOpen(false)}
                              className="flex h-[38px] items-center border-t border-[#dddddd] px-3 pl-6 text-left text-sm text-[#4b5563] transition-colors hover:bg-[#fafafa] hover:text-[#ef2b10]"
                            >
                              <span>{subLabel}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </nav>
            </div>

            <nav className="mt-4 border-t border-[#eeeeee] pt-3">
              <Link
                to="/wishlist"
                onClick={() => setOpen(false)}
                className="block rounded-[4px] px-3 py-3 text-[15px] font-medium text-[#111827] hover:bg-[#f5f5f5]"
              >
                Wishlist
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
