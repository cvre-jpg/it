import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart } from "lucide-react";
import { ProductSummaryWithCategory } from "@/lib/products";
import { formatKES } from "@/lib/format";
import { useStore } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { handleWhatsAppLinkClick, inquireSingle } from "@/lib/whatsapp";
import { DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { buildResponsiveImageAttrs } from "@/lib/images";

export function ProductCard({
  product,
  whatsAppNumber = DEFAULT_WHATSAPP_NUMBER,
}: {
  product: ProductSummaryWithCategory;
  whatsAppNumber?: string;
}) {
  const { addToCart, toggleWishlist, inWishlist } = useStore();
  const buyNowHref = inquireSingle(whatsAppNumber, product.title, Number(product.price));

  const liked = inWishlist(product.id);
  const img = product.images?.[0];
  const displayOldPrice =
    product.old_price && Number(product.old_price) > Number(product.price) ? Number(product.old_price) : null;
  const showOldPrice = Boolean(displayOldPrice);
  const badgeLabel =
    product.badge === "Sale" && displayOldPrice
      ? `${Math.round(((displayOldPrice - Number(product.price)) / displayOldPrice) * 100)}% OFF`
      : product.badge || null;
  const imageAttrs = buildResponsiveImageAttrs(img, {
    width: 520,
    height: 520,
    mode: "fit",
    widths: [180, 260, 360, 520],
    sizes: "(max-width: 639px) 68vw, (max-width: 1023px) 50vw, (max-width: 1279px) 25vw, 20vw",
    quality: "q_auto:eco",
  });
  return (
    <div className="group relative mb-3 flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition duration-200 ease-[ease] hover:-translate-y-0.5 active:scale-[0.98] sm:mb-0 sm:rounded-xl sm:border sm:bg-card sm:p-[4px] sm:shadow-none">
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="relative block h-[220px] w-full overflow-hidden bg-white sm:aspect-square sm:h-auto sm:rounded-[calc(theme(borderRadius.xl)-4px)]"
      >
        {img && (
          <img src={imageAttrs.src} srcSet={imageAttrs.srcSet} sizes={imageAttrs.sizes} alt={product.title} loading="lazy" decoding="async"
            className="h-full w-full object-contain object-center transition-transform duration-200 ease-[ease] group-hover:scale-[1.02]" />
        )}
        <div className="absolute left-2 right-2 top-2 flex items-start justify-between sm:left-3 sm:right-3 sm:top-3">
          {badgeLabel ? (
            <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold tracking-[0.04em] text-primary-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">
              {badgeLabel}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Toggle wishlist"
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist({
                id: product.id,
                slug: product.slug,
                title: product.title,
                price: Number(product.price),
                image: img,
              });
              toast.success(liked ? "Removed from wishlist" : "Added to wishlist");
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow-[0_6px_18px_rgba(15,23,42,0.14)] backdrop-blur transition hover:scale-105 sm:h-8 sm:w-8"
          >
            <Heart className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", liked ? "fill-primary text-primary" : "text-foreground")} />
          </button>
        </div>
      </Link>

      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="bg-white px-[4px] pb-[10px] pt-2 sm:mt-1.5 sm:flex sm:flex-col sm:gap-0.5 sm:bg-transparent sm:px-[1px] sm:pb-[1px] sm:pt-0"
        title={product.title}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 whitespace-nowrap">
          <span className="text-[14px] font-bold leading-none text-[#E30613] transition-colors group-hover:text-[#c70511] sm:text-[13px] sm:text-foreground sm:group-hover:text-primary">
            {formatKES(Number(product.price))}
          </span>
          {showOldPrice ? (
            <span className="ml-auto text-[10px] text-[#9CA3AF] line-through sm:text-[10px] sm:text-muted-foreground">
              {formatKES(displayOldPrice ?? 0)}
            </span>
          ) : null}
        </div>
        <span className="overflow-hidden text-[13px] font-normal leading-[1.35] text-[#222222] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] sm:line-clamp-2 sm:min-h-[2.15rem] sm:text-[12px] sm:font-medium sm:leading-[1.3] sm:text-[#3f3f46] sm:group-hover:text-primary">
          {product.title}
        </span>
      </Link>

      <div className="hidden sm:mt-1.5 sm:grid sm:grid-cols-[1.7fr_1fr] sm:gap-1.5 sm:px-[1px] sm:pb-[1px]">
        <Button asChild size="sm" className="h-8 w-full rounded-full bg-[#e92d48] px-2 text-[11px] text-white hover:bg-[#d61f3d]">
          <a href={buyNowHref} onClick={(event) => handleWhatsAppLinkClick(event, buyNowHref)}>
            Buy now
          </a>
        </Button>
        <Button
          size="sm" variant="outline" className="h-8 w-full rounded-full border-[#d4d4d8] bg-white px-0 text-[11px] text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#27272a]"
          onClick={() => {
            addToCart({ id: product.id, slug: product.slug, title: product.title, price: Number(product.price), image: img });
            toast.success("Added to cart");
          }}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cart</span>
        </Button>
      </div>
    </div>
  );
}
