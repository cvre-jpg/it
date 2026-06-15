import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchProductPageData } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowRight,
  Facebook,
  Heart,
  Link2,
  Mail,
  MessageCircle,
  Pin,
  Share2,
  ShoppingCart,
  Twitter,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { formatKES } from "@/lib/format";
import { buildWaMessage, handleWhatsAppLinkClick, waLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";
import { DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import useEmblaCarousel from "embla-carousel-react";
import { absoluteUrl, buildMetaDescription, buildTitle, cleanText } from "@/lib/seo";
import { buildResponsiveImageAttrs, optimizeImageUrl } from "@/lib/images";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ params }) => fetchProductPageData(params.slug),
  pendingComponent: ProductPendingPage,
  pendingMs: 0,
  pendingMinMs: 0,
  head: ({ loaderData, params }) => {
    const product = loaderData.product;
    const title = product ? buildTitle(product.title) : buildTitle("Product");
    const description = buildMetaDescription(
      product?.description ??
        `${product?.title ?? "Product"} at Shop ICT Gadgets. View price, availability and specifications.`,
      "View product details, price and availability at Shop ICT Gadgets.",
    );
    const image = product?.images?.[0] ? absoluteUrl(optimizeImageUrl(product.images[0], { width: 1200, height: 1200, mode: "fit" })) : absoluteUrl("/logo.png");
    const url = absoluteUrl(`/products/${params.slug}`);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ProductPage,
});

function ProductPendingPage() {
  return (
    <div className="site-desktop-width mx-auto px-6 py-20">
      <div className="grid gap-y-6 lg:grid-cols-[460px_minmax(0,1fr)] lg:gap-x-6">
        <Skeleton className="aspect-square w-full rounded-[8px] sm:max-w-[500px] lg:max-w-[460px]" />
        <div className="space-y-4 lg:pl-[50px]">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-28" />
          <div className="grid max-w-[280px] grid-cols-[minmax(0,0.7fr)_minmax(0,0.66fr)] gap-2">
            <Skeleton className="h-10 rounded-[5px]" />
            <Skeleton className="h-10 rounded-[5px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

const FALLBACK_DESCRIPTION = [
  'HP EliteBook 840 G3 Laptop 14" FHD Display Touch Screen, Intel Core i5 6300U 2.4Ghz, 256GB SSD, 8GB DDR4 RAM, Webcam, WiFi, Windows 10 Pro',
  "Intel i5 6300U 2.4 GHz and 8GB DDR4 SDRAM, with long-lasting battery life.",
  "8GB DDR4 RAM (Supports Max 32GB) | 256GB SSD | Webcam",
  '14.0" diagonal LED backlight FHD (1920x1080) Display | Intel HD Graphics 520',
  "Windows 10 Professional 64-bit / AC Adapter",
] as const;
function firstMatch(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match?.[1] ?? null;
}

function deriveScreenSize(title: string) {
  return firstMatch(title, /(\d{1,2}(?:\.\d+)?)\s*(?:inch|in|”|")/i);
}

function deriveRam(title: string) {
  return firstMatch(title, /(\d+)\s*gb\s*ram/i);
}

function deriveStorage(title: string) {
  const storageMatches = [...title.matchAll(/(\d+\s*(?:gb|tb))(?:\s*ssd)?/gi)].map((match) => match[1]);
  return storageMatches.find((value) => !/^(8|16|32)\s*gb$/i.test(value)) ?? storageMatches[0] ?? null;
}

function deriveProcessor(title: string) {
  const match = title.match(/(core\s+ultra\s+\d+|ultra\s+\d+|core\s+i[3579]|ci[3579]|ryzen\s+\d+|celeron|pentium)/i)?.[1];
  if (!match) return null;
  return match
    .replace(/\bci(\d)\b/i, "Core i$1")
    .replace(/\bcore\s+/i, "Core ")
    .replace(/\bultra\s+/i, "Ultra ")
    .replace(/\bryzen\s+/i, "Ryzen ");
}

function deriveColour(title: string) {
  const match = title.match(/\b(white|black|silver|grey|gray|blue)\b/i)?.[1];
  if (!match) return null;
  return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
}

function deriveCondition(title: string, subcategory: string | null) {
  const source = `${title} ${subcategory ?? ""}`.toLowerCase();
  if (source.includes("ex-uk") || source.includes("refurb")) return "Refurbished";
  return "New";
}

function normalizeMonitorSizeValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (!normalized) continue;

    const numericMatch = normalized.match(/(\d{1,3}(?:\.\d+)?)/);
    if (numericMatch?.[1]) {
      return numericMatch[1];
    }
  }

  return "Not specified";
}

type ProductPagePayload = Awaited<ReturnType<typeof fetchProductPageData>>;
type ProductRecord = NonNullable<ProductPagePayload["product"]>;

function isMonitorProduct(product: ProductRecord | null | undefined) {
  return normalizeValue(product?.categories?.name) === "monitors";
}

function buildSpecRows(product: ProductRecord | null | undefined) {
  if (!product) return [] as Array<[string, string]>;

  const specs = product.specs || {};
  const title = product.title;
  const categoryName = product.categories?.name || "Product";
  const subcategory = product.subcategories?.length
    ? product.subcategories.join(", ")
    : product.subcategory || String(specs["Subcategory"] || "");
  const derivedScreenSize = deriveScreenSize(title);
  const derivedRam = deriveRam(title);
  const derivedStorage = deriveStorage(title);
  const derivedProcessor = deriveProcessor(title);
  const derivedColour = deriveColour(title);
  const derivedCondition = deriveCondition(title, product.subcategory);
  const monitorProduct = isMonitorProduct(product);
  const sizeValue = monitorProduct
    ? normalizeMonitorSizeValue(specs["Size"], specs["Screen Size"], specs["Screen size (in)"], derivedScreenSize, title)
    : String(specs["Size"] || specs["HDD size"] || specs["Storage"] || derivedStorage || "Not specified");
  const baseSpecRows: Array<[string, string]> = [
    ["Model Number", String(specs["Model Number"] || title)],
    ["Features", String(specs["Features"] || subcategory || categoryName)],
    ["Colour", String(specs["Colour"] || derivedColour || "Not specified")],
    ["Condition", String(specs["Condition"] || derivedCondition)],
    ["Size", sizeValue],
  ];

  if (!monitorProduct) {
    baseSpecRows.push(
      ["Operating system", String(specs["Operating system"] || (categoryName === "Laptops" ? "Windows 11" : "Not specified"))],
      ["Processor", String(specs["Processor"] || derivedProcessor || "Not specified")],
      ["RAM (GB)", String(specs["RAM (GB)"] || specs["RAM"] || derivedRam || "Not specified")],
      ["Screen size (in)", String(specs["Screen size (in)"] || derivedScreenSize || "Not specified")],
      ["SKU", String(specs["SKU"] || product.slug.toUpperCase())],
    );
  }

  const displayedLabels = new Set(baseSpecRows.map(([label]) => label));
  const extraSpecRows = Object.entries(specs)
    .filter(([label, value]) => {
      if (displayedLabels.has(label)) return false;
      if (monitorProduct && ["Operating system", "Processor", "RAM (GB)", "RAM", "Screen size (in)", "Screen Size", "SKU"].includes(label)) {
        return false;
      }

      const normalizedValue = String(value ?? "").trim();
      return normalizedValue.length > 0 && normalizedValue.toLowerCase() !== "not specified";
    })
    .map(([label, value]) => [label, String(value)] as [string, string]);

  return [...baseSpecRows, ...extraSpecRows];
}

function normalizeValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function ProductPage() {
  const { slug } = Route.useParams();
  const loaderProductPageData = Route.useLoaderData();
  const { data: productPageData, isLoading } = useQuery({
    queryKey: ["product-page", slug],
    queryFn: () => fetchProductPageData(slug),
    initialData: loaderProductPageData,
    staleTime: 1000 * 60 * 10,
  });
  const product = productPageData?.product ?? null;
  const relatedData = productPageData?.related ?? { products: [], isFallback: false };
  const wa = productPageData?.whatsappNumber ?? DEFAULT_WHATSAPP_NUMBER;
  const { addToCart, toggleWishlist, inWishlist } = useStore();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [imageZoomOrigin, setImageZoomOrigin] = useState("50% 50%");
  const [relatedEmblaRef, relatedEmblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: true,
    slidesToScroll: 1,
  });

  useEffect(() => {
    if (!relatedEmblaApi) return;

    const autoplay = window.setInterval(() => {
      relatedEmblaApi.scrollNext();
    }, 5000);

    return () => window.clearInterval(autoplay);
  }, [relatedEmblaApi]);

  useEffect(() => {
    if (activeImg !== 0) {
      setActiveImg(0);
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="site-desktop-width mx-auto px-6 py-20">
        <div className="grid gap-y-6 lg:grid-cols-[460px_minmax(0,1fr)] lg:gap-x-6">
          <Skeleton className="aspect-square w-full rounded-[8px] sm:max-w-[500px] lg:max-w-[460px]" />
          <div className="space-y-4 lg:pl-[50px]">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28" />
            <div className="grid max-w-[280px] grid-cols-[minmax(0,0.7fr)_minmax(0,0.66fr)] gap-2">
              <Skeleton className="h-10 rounded-[5px]" />
              <Skeleton className="h-10 rounded-[5px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="site-desktop-width mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-primary">
          Back to shop →
        </Link>
      </div>
    );
  }

  const imgs = product.images?.length ? product.images : ["https://placehold.co/800x800?text=No+Image"];
  const activeImageAttrs = buildResponsiveImageAttrs(imgs[activeImg], {
    width: 1200,
    height: 1200,
    mode: "fit",
    widths: [320, 480, 720, 960, 1200],
    sizes: "(max-width: 1023px) 100vw, 460px",
    quality: "q_auto:eco",
  });
  const liked = inWishlist(product.id);
  const displayOldPrice =
    product.old_price && Number(product.old_price) > Number(product.price)
      ? Number(product.old_price)
      : null;
  const showOldPrice = Boolean(displayOldPrice);
  const badgeLabel =
    product.badge === "Sale" && displayOldPrice
      ? `${Math.round(((displayOldPrice - Number(product.price)) / displayOldPrice) * 100)}% OFF`
      : product.badge || null;
  const relatedProducts = relatedData.products;
  const relatedProductsHeading = relatedData.isFallback ? "Other products" : "Similar products";
  const relatedProductsCopy = relatedData.isFallback
    ? "More picks from across the store."
    : `More picks from ${product.categories?.name || "this category"}.`;
  const descriptionLines = product.description
    ? product.description.split(/\n+/).filter(Boolean)
    : [...FALLBACK_DESCRIPTION];
  const brand = product.brand || product.title.split(" ")[0] || "Brand";
  const waMsg = buildWaMessage([{ title: product.title, quantity: qty, price: Number(product.price) }]);
  const buyNowHref = waLink(wa, waMsg);
  const shareUrl = typeof window !== "undefined" ? window.location.href : absoluteUrl(`/products/${product.slug}`);
  const specRows = buildSpecRows(product);
  const productUrl = absoluteUrl(`/products/${product.slug}`);
  const productDescription = buildMetaDescription(
    product.description ?? descriptionLines.join(" "),
    "View product details, price and availability at Shop ICT Gadgets.",
    500,
  );
  const productStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cleanText(product.title),
    image: (product.images ?? []).map((image) => absoluteUrl(optimizeImageUrl(image, { width: 1200, height: 1200, mode: "fit" }))),
    description: productDescription,
    sku: cleanText(product.specs?.SKU ?? product.specs?.["Model Number"] ?? product.slug.toUpperCase()),
    brand: product.brand
      ? {
          "@type": "Brand",
          name: cleanText(product.brand),
        }
      : undefined,
    category: cleanText(product.categories?.name ?? product.subcategory ?? "Electronics"),
    url: productUrl,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "KES",
      price: Number(product.price ?? 0).toFixed(2),
      availability:
        product.stock_status === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      itemCondition:
        deriveCondition(product.title, product.subcategory) === "Refurbished"
          ? "https://schema.org/RefurbishedCondition"
          : "https://schema.org/NewCondition",
    },
  };
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: absoluteUrl("/shop"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cleanText(product.title),
        item: productUrl,
      },
    ],
  };
  const goToPrevImage = () => setActiveImg((current) => (current === 0 ? imgs.length - 1 : current - 1));
  const goToNextImage = () => setActiveImg((current) => (current === imgs.length - 1 ? 0 : current + 1));

  useEffect(() => {
    if (imgs.length <= 1) return;

    const autoplay = window.setInterval(() => {
      goToNextImage();
    }, 15000);

    return () => window.clearInterval(autoplay);
  }, [imgs.length]);

  const shareButtons = [
    {
      label: "Twitter",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.title)}`,
      color: "text-[#1d9bf0]",
      content: <Twitter className="h-4 w-4" />,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: "text-[#1877f2]",
      content: <Facebook className="h-4 w-4" />,
    },
    {
      label: "WhatsApp",
      href: waLink(wa, waMsg),
      color: "text-[#25d366]",
      content: <MessageCircle className="h-4 w-4" />,
    },
    {
      label: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(product.title)}`,
      color: "text-[#e60023]",
      content: <Pin className="h-4 w-4" />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(product.title)}&body=${encodeURIComponent(shareUrl)}`,
      color: "text-[#1e3a8a]",
      content: <Mail className="h-4 w-4" />,
    },
  ] as const;
  const purchaseControls = (
    <>
      <div className="mt-4 flex justify-start">
        <div className="space-y-1">
          <label htmlFor="quantity" className="block text-[12px] font-medium text-[#111827]">
            Quantity
          </label>
          <div
            id="quantity"
            className="inline-flex h-7 w-fit items-center overflow-hidden rounded-[4px] border border-[#cbd5e1] bg-white"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((current) => Math.max(1, current - 1))}
              className="flex h-full w-7 items-center justify-center text-[12px] font-semibold text-[#374151] transition hover:bg-[#f8fafc] active:scale-[0.98]"
            >
              -
            </button>
            <div className="flex h-full min-w-[30px] items-center justify-center border-x border-[#e5e7eb] px-1.5 text-[12px] font-medium text-[#111827]">
              {qty}
            </div>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((current) => Math.min(99, current + 1))}
              className="flex h-full w-7 items-center justify-center text-[12px] font-semibold text-[#374151] transition hover:bg-[#f8fafc] active:scale-[0.98]"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,0.7fr)_minmax(0,0.66fr)] gap-2 sm:max-w-[250px]">
        <Button
          asChild
          size="lg"
          className="h-10 rounded-[5px] bg-primary px-3 text-[15px] text-primary-foreground hover:bg-primary/90"
        >
          <a href={buyNowHref} onClick={(event) => handleWhatsAppLinkClick(event, buyNowHref)}>
            Buy now
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-10 rounded-[5px] border-[#d8dee6] bg-white px-3 text-[15px] text-[#374151] hover:bg-[#f8fafc] hover:text-[#111827]"
          onClick={() => {
            addToCart(
              {
                id: product.id,
                slug: product.slug,
                title: product.title,
                price: Number(product.price),
                image: imgs[0],
              },
              qty,
            );
            toast.success("Added to cart");
          }}
        >
          <ShoppingCart className="h-4 w-4" /> Add to cart
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-2 h-9 w-fit justify-start rounded-[5px] border-0 bg-transparent px-0 text-[13px] text-[#6b7280] shadow-none hover:bg-transparent hover:text-[#111827]"
        onClick={() => {
          toggleWishlist({
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: Number(product.price),
            image: imgs[0],
          });
          toast.success(liked ? "Removed from wishlist" : "Added to wishlist");
        }}
      >
        <Heart className="h-3.5 w-3.5" />
        {liked ? "Remove from wishlist" : "Add to wishlist"}
      </Button>
    </>
  );
  const shareMenu = (
    <div className="absolute right-0 top-full z-20 mt-2 flex items-center gap-2 rounded-[8px] border border-[#d8dee6] bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
      {shareButtons.map((button) => (
        <a
          key={button.label}
          href={button.href}
          target={button.label === "WhatsApp" ? undefined : "_blank"}
          rel={button.label === "WhatsApp" ? undefined : "noreferrer"}
          aria-label={button.label}
          onClick={(event) => {
            setShareOpen(false);
            if (button.label === "WhatsApp") {
              handleWhatsAppLinkClick(event, button.href);
            }
          }}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#d8dee6] bg-white",
            button.color,
          )}
        >
          {button.content}
        </a>
      ))}

      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(shareUrl);
          setShareOpen(false);
          toast.success("Product link copied");
        }}
        aria-label="Copy link"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#d8dee6] bg-white text-[#1e3a8a]"
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  );
  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      <div className="site-desktop-width mx-auto px-4 pt-8 pb-[20px] md:px-6 md:pt-12 md:pb-[20px]">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
          <Link to="/shop" className="hover:text-foreground">Shop</Link> /{" "}
          <span className="text-foreground">{product.title}</span>
        </nav>

        <div className="grid gap-y-6 lg:grid-cols-[460px_minmax(0,1fr)] lg:gap-x-6">
          <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
            <div
              className="relative aspect-square w-full overflow-hidden bg-white sm:max-w-[500px] sm:rounded-[6px] sm:border sm:border-[#d8dee6] lg:max-w-[460px] lg:cursor-zoom-in"
              onMouseEnter={() => {
                if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                  setIsImageZoomed(true);
                }
              }}
              onMouseMove={(event) => {
                if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

                const bounds = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                setImageZoomOrigin(`${x}% ${y}%`);
              }}
              onMouseLeave={() => {
                setIsImageZoomed(false);
                setImageZoomOrigin("50% 50%");
              }}
            >
              <img
                src={activeImageAttrs.src}
                srcSet={activeImageAttrs.srcSet}
                sizes={activeImageAttrs.sizes}
                alt={product.title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className={cn(
                  "h-full w-full object-contain object-center transition-transform duration-300 ease-out",
                  isImageZoomed ? "scale-[1.7]" : "scale-100",
                )}
                style={{ transformOrigin: imageZoomOrigin }}
                onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                onTouchEnd={(event) => {
                  if (touchStartX === null) return;
                  const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
                  const deltaX = touchEndX - touchStartX;

                  if (Math.abs(deltaX) > 40) {
                    if (deltaX > 0) {
                      goToPrevImage();
                    } else {
                      goToNextImage();
                    }
                  }

                  setTouchStartX(null);
                }}
              />
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
                  onClick={() => {
                    toggleWishlist({
                      id: product.id,
                      slug: product.slug,
                      title: product.title,
                      price: Number(product.price),
                      image: imgs[0],
                    });
                    toast.success(liked ? "Removed from wishlist" : "Added to wishlist");
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow-[0_6px_18px_rgba(15,23,42,0.14)] backdrop-blur transition hover:scale-105 sm:h-8 sm:w-8"
                >
                  <Heart className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", liked && "fill-primary text-primary")} />
                </button>
              </div>
              <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium leading-none text-white">
                {activeImg + 1} / {imgs.length}
              </span>
            </div>

            <div className="mt-3 hidden flex-wrap items-center gap-3 px-[10px] pb-3 sm:mt-5 sm:flex sm:px-0 sm:pb-0">
              {imgs.slice(0, 4).map((src, index) => (
                <button
                  key={src + index}
                  type="button"
                  onClick={() => setActiveImg(index)}
                  className={cn(
                    "aspect-square w-[56px] overflow-hidden rounded-[6px] border bg-white shadow-sm transition-colors sm:w-[72px]",
                    activeImg === index ? "border-primary" : "border-[#d8dee6]",
                  )}
                >
                  <img src={optimizeImageUrl(src, { width: 180, height: 180, mode: "fit" })} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain object-center" />
                </button>
              ))}
            </div>

            <div className="bg-white px-[10px] pb-[10px] pt-2 sm:hidden">
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[16px] font-bold leading-none text-[#E30613]">{formatKES(Number(product.price))}</span>
                  {showOldPrice ? (
                    <>
                      <span className="text-[11px] text-[#9CA3AF] line-through">{formatKES(displayOldPrice ?? 0)}</span>
                      {displayOldPrice ? (
                        <span className="text-[11px] font-medium text-[#EF4444]">
                          (-{Math.round(((displayOldPrice - Number(product.price)) / displayOldPrice) * 100)}%)
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Share product"
                    onClick={() => setShareOpen((open) => !open)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#d8dee6] bg-white text-[#6b7280] transition hover:text-[#111827]"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  {shareOpen ? shareMenu : null}
                </div>
              </div>
              <h1 className="mt-0.5 text-[13px] font-normal leading-[1.35] text-[#222222] [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
                {product.title}
              </h1>
              <p className="mt-1.5 text-[10px] text-[#6B7280]">
                by <span className="text-primary">{brand}</span>
              </p>
              <div className="mt-4">
                {purchaseControls}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex sm:flex-col lg:pl-[50px]">
            <h1 className="text-[28px] font-normal leading-[1.18] text-[#111827] md:text-[34px]">
              {product.title}
            </h1>

            <p className="mt-2 text-[12px] text-[#6b7280]">
              by <span className="text-primary">{brand}</span>
            </p>

            <div className="mt-4 w-full">
              <div className="flex items-start justify-between gap-4 text-left">
                <div>
                  <div className="text-[30px] font-normal text-primary">
                    {formatKES(Number(product.price))}
                  </div>
                  {showOldPrice ? (
                    <div className="mt-1 text-sm text-[#8a8a8a] line-through">
                      {formatKES(displayOldPrice ?? 0)}
                    </div>
                  ) : null}
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Share product"
                    onClick={() => setShareOpen((open) => !open)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8dee6] bg-white text-[#6b7280] transition hover:text-[#111827]"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  {shareOpen ? shareMenu : null}
                </div>
              </div>

              {purchaseControls}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="lg:hidden">
              <Tabs defaultValue="specifications" className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-2 rounded-2xl bg-transparent p-0 sm:w-fit">
                  <TabsTrigger value="specifications" className="justify-start rounded-xl border-0 bg-transparent px-4 text-left text-[#6b7280] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-[#E30613] data-[state=active]:shadow-none">
                    Specifications
                  </TabsTrigger>
                  <TabsTrigger value="description" className="justify-start rounded-xl border-0 bg-transparent px-4 text-left text-[#6b7280] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-[#E30613] data-[state=active]:shadow-none">
                    Description
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="specifications" className="mt-0">
                  <div className="overflow-hidden rounded-[8px] border border-[#d8dee6] bg-transparent">
                    {specRows.map(([label, value]) => (
                      <div
                        key={label}
                        className="grid min-h-[32px] grid-cols-[130px_minmax(0,1fr)] border-b border-[#d8dee6] text-[13px] last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:text-[14px]"
                      >
                        <div className="px-3 py-2 font-semibold text-[#111827] sm:px-4">{label}</div>
                        <div className="px-3 py-2 text-[#111827] sm:px-4">{value}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="description" className="mt-0">
                  <div className="space-y-4 rounded-[8px] border border-[#d8dee6] bg-transparent p-4 text-[14px] leading-[1.6] text-[#0f172a] sm:p-5">
                    {descriptionLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-8">
              <div>
                <h2 className="mb-4 text-[18px] font-semibold text-[#111827]">Description</h2>
                <div className="space-y-4 rounded-[8px] bg-transparent p-5 text-[14px] leading-[1.6] text-[#0f172a]">
                  {descriptionLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-4 text-[18px] font-semibold text-[#111827]">Specifications</h2>
                <div className="overflow-hidden rounded-[8px] border border-[#d8dee6] bg-transparent">
                  {specRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid min-h-[32px] grid-cols-[150px_minmax(0,1fr)] border-b border-[#d8dee6] text-[14px] last:border-b-0"
                    >
                      <div className="px-4 py-2 font-semibold text-[#111827]">{label}</div>
                      <div className="px-4 py-2 text-[#111827]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 ? (
          <section className="mt-14 border-t pt-10">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{relatedProductsHeading}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {relatedProductsCopy}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => relatedEmblaApi?.scrollPrev()}
                  aria-label="Previous related products"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <ArrowLeft className="h-4.5 w-4.5" strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  onClick={() => relatedEmblaApi?.scrollNext()}
                  aria-label="Next related products"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <ArrowRight className="h-4.5 w-4.5" strokeWidth={1.7} />
                </button>
              </div>
            </div>

            <div className="overflow-hidden" ref={relatedEmblaRef}>
              <div className="-ml-4 flex">
                {relatedProducts.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-0 flex-[0_0_68%] pl-4 sm:flex-[0_0_50%] lg:flex-[0_0_25%]"
                  >
                    <ProductCard product={item} whatsAppNumber={wa} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
