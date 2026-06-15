import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { useWhatsAppNumber, DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { formatKES } from "@/lib/format";
import { handleWhatsAppLinkClick, inquireSingle } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist - Shop ICT Gadgets" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const { data: wa = DEFAULT_WHATSAPP_NUMBER } = useWhatsAppNumber();

  if (wishlist.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-3xl font-bold">No wishlist items</h1>
        <p className="mt-2 text-muted-foreground">Save products to revisit them later.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/shop">Browse products</Link></Button>
      </div>
    );
  }

  return (
    <div className="site-desktop-width mx-auto px-4 py-10 md:px-6">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">Wishlist</h1>
      <div className="grid gap-2.5">
        {wishlist.map((item) => (
          <div key={item.id} className="relative flex gap-3 rounded-xl border bg-card p-3">
            <button
              onClick={() => toggleWishlist({ id: item.id, slug: item.slug, title: item.title, price: item.price, image: item.image })}
              className="absolute right-2.5 top-2.5 z-10 rounded-full bg-white/95 p-1 text-muted-foreground shadow-sm transition hover:text-primary"
              aria-label="Remove from wishlist"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <Link to="/products/$slug" params={{ slug: item.slug }} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white">
              {item.image && <img src={item.image} alt={item.title} className="h-full w-full object-contain object-center" />}
            </Link>
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <Link to="/products/$slug" params={{ slug: item.slug }} className="line-clamp-2 pr-6 text-[13px] font-medium leading-[1.35] hover:text-primary">
                  {item.title}
                </Link>
                <div className="mt-1 text-[12px] font-medium text-muted-foreground">{formatKES(item.price)}</div>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:flex-wrap sm:items-center">
                <Button asChild size="sm" className="h-7 w-full rounded-full bg-[#e92d48] px-2.5 text-[10px] text-white hover:bg-[#d61f3d]">
                  <a
                    href={inquireSingle(wa, item.title, item.price)}
                    onClick={(event) => handleWhatsAppLinkClick(event, inquireSingle(wa, item.title, item.price))}
                  >
                    Buy now
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-full rounded-full border-[#d4d4d8] bg-white px-2.5 text-[10px] text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#27272a]" onClick={() => { addToCart({ id: item.id, slug: item.slug, title: item.title, price: item.price, image: item.image }); toast.success("Added to cart"); }}>
                  <ShoppingCart className="h-2.5 w-2.5" /> Add to cart
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
