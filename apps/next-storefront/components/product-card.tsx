import Image from "next/image";
import Link from "next/link";
import { getOptimizedImageUrl, getProductAlt } from "@/lib/images";
import type { Product } from "@/lib/types";
import { formatCurrency, shimmer, toBase64 } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const image = getOptimizedImageUrl(product.images[0], { width: 720, height: 720 });

  return (
    <article className="group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-soft">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-sand">
          {image ? (
            <Image
              src={image}
              alt={getProductAlt(product.title, product.brand)}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              placeholder="blur"
              blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(720, 720))}`}
            />
          ) : null}
        </div>
        <div className="space-y-2 p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-black/45">
            {product.brand || product.categoryName || "Product"}
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-ink">{product.title}</h3>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-accent">{formatCurrency(product.price)}</span>
            {product.oldPrice ? (
              <span className="text-sm text-black/40 line-through">{formatCurrency(product.oldPrice)}</span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
