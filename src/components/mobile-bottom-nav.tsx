import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, ShoppingCart, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useWhatsAppNumber, DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { useEffect, useState } from "react";
import { handleWhatsAppLinkClick, waLink } from "@/lib/whatsapp";

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { cartCount, wishlist } = useStore();
  const { data: wa = DEFAULT_WHATSAPP_NUMBER } = useWhatsAppNumber();
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  useEffect(() => {
    let seenPrompt = "1";
    if (typeof window !== "undefined") {
      try {
        seenPrompt = window.sessionStorage.getItem("wa-prompt-dismissed") ?? "";
      } catch {
        seenPrompt = "1";
      }
    }
    if (seenPrompt) return;

    const showTimer = window.setTimeout(() => {
      setShowWhatsAppPrompt(true);
    }, 3000);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, []);

  if (path.startsWith("/admin")) return null;

  const items = [
    { to: "/wishlist", icon: Heart, label: "Wishlist", badge: wishlist.length, badgeClassName: "right-1 top-1" },
    { to: "/cart", icon: ShoppingCart, label: "Cart", badge: cartCount },
    { href: waLink(wa, "Hello Shop ICT Gadgets, I have a question."), icon: MessageCircle, label: "WhatsApp" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto w-[calc(100%-2.75rem)] max-w-[21rem] lg:hidden">
      <div className="flex items-center justify-around rounded-full border border-[#ececec] bg-white px-1.5 py-1.5 shadow-elegant">
        {items.map((it: any, idx) => {
          const active = it.to && (it.to === "/" ? path === "/" : path.startsWith(it.to));
          const Icon = it.icon;
          const inner = (
            <span className={cn("relative grid place-items-center rounded-full px-2.5 py-1.5 transition", active && "text-primary")}>
              <Icon className={cn("h-4.5 w-4.5", active && "fill-primary text-primary")} />
              {it.badge ? (
                <span className={cn("absolute -right-0.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground", it.badgeClassName)}>
                  {it.badge}
                </span>
              ) : null}
              <span className="mt-0.5 text-[9px] font-medium">{it.label}</span>
            </span>
          );
          return (
            <div key={idx} className="relative flex flex-1 justify-center">
              {it.href && showWhatsAppPrompt ? (
                <div className="absolute bottom-full mb-3 w-[190px] rounded-2xl bg-white px-3 py-2 text-center text-[11px] font-medium text-[#111827] shadow-[0_18px_40px_-20px_rgba(17,24,39,0.35)]">
                  <button
                    type="button"
                    aria-label="Close WhatsApp prompt"
                    className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[#9ca3af] transition-colors hover:bg-[#f5f5f5] hover:text-[#111827]"
                    onClick={() => {
                      setShowWhatsAppPrompt(false);
                      try {
                        window.sessionStorage.setItem("wa-prompt-dismissed", "true");
                      } catch {
                        // Ignore storage permission and quota issues.
                      }
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="pr-4">
                    Need help? Chat with us on WhatsApp.
                  </div>
                  <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 rotate-45 bg-white" aria-hidden="true" />
                </div>
              ) : null}

              {it.href ? (
                <a
                  href={it.href}
                  onClick={(event) => {
                    setShowWhatsAppPrompt(false);
                    handleWhatsAppLinkClick(event, it.href);
                  }}
                >
                  {inner}
                </a>
              ) : (
                <Link to={it.to} onClick={() => setShowWhatsAppPrompt(false)}>
                  {inner}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
