import Image from "next/image";
import { notFound } from "next/navigation";
import { BreadcrumbTrail } from "@/components/breadcrumb-trail";
import { JsonLd } from "@/components/json-ld";
import { ProductGrid } from "@/components/product-grid";
import { getOptimizedImageUrl, getProductAlt } from "@/lib/images";
import { getCatalog, getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";
import { breadcrumbSchema, productSchema } from "@/lib/schema";
import { formatCurrency, shimmer, toBase64 } from "@/lib/utils";

export const revalidate = 3600;

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.products.slice(0, 250).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return buildMetadata({
    title: buildTitle(product.title),
    description: buildDescription(product.description, `${product.title} at Shop ICT Gadgets.`),
    path: `/products/${product.slug}`,
    image: product.images[0] ? absoluteUrl(product.images[0]) : undefined,
    keywords: [product.title, product.brand || "", product.categoryName || "", ...product.subcategories].filter(Boolean),
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(product, 4);
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: product.categoryName || "Products", href: `/categories/${product.categorySlug ?? ""}` },
    { name: product.title, href: `/products/${product.slug}` },
  ];
  const primaryImage = getOptimizedImageUrl(product.images[0], { width: 1200, height: 1200 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={productSchema(product)} />
      <BreadcrumbTrail items={breadcrumbs} />

      <section className="mt-6 grid gap-8 lg:grid-cols-[1fr_0.95fr]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-soft">
            {primaryImage ? (
              <Image
                src={primaryImage}
                alt={getProductAlt(product.title, product.brand)}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                placeholder="blur"
                blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(1200, 1200))}`}
              />
            ) : null}
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(0, 4).map((image, index) => (
                <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl border border-black/5 bg-white">
                  <Image
                    src={getOptimizedImageUrl(image, { width: 320, height: 320 })}
                    alt={getProductAlt(product.title, product.brand)}
                    fill
                    sizes="25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <article className="rounded-[32px] border border-black/5 bg-white p-8 shadow-soft">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">{product.brand || product.categoryName}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{product.title}</h1>
          <div className="mt-5 flex items-center gap-4">
            <span className="text-3xl font-bold text-accent">{formatCurrency(product.price)}</span>
            {product.oldPrice ? (
              <span className="text-lg text-black/35 line-through">{formatCurrency(product.oldPrice)}</span>
            ) : null}
          </div>
          <p className="mt-5 text-base leading-7 text-black/70">
            {product.description || `${product.title} with strong specifications, fast delivery, and clean structured product data.`}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-black/45">Availability</div>
              <div className="mt-2 text-base font-medium text-ink">
                {product.stockStatus === "in_stock" ? "In stock" : "Available on request"}
              </div>
            </div>
            <div className="rounded-3xl bg-[#f7f4ee] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-black/45">Category</div>
              <div className="mt-2 text-base font-medium text-ink">{product.categoryName || "Electronics"}</div>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-black/5 bg-[#fbfaf7] p-5">
            <h2 className="text-lg font-semibold text-ink">Specifications</h2>
            <dl className="mt-4 grid gap-3">
              {Object.entries(product.specs)
                .filter(([, value]) => String(value).trim())
                .slice(0, 12)
                .map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[150px_1fr] gap-3 border-b border-black/5 pb-3 text-sm last:border-b-0">
                    <dt className="text-black/50">{key}</dt>
                    <dd className="font-medium text-ink">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </article>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Related products</h2>
          <p className="mt-2 text-sm text-black/65">Semantic internal linking for stronger discovery and better crawl depth.</p>
          <div className="mt-6">
            <ProductGrid products={relatedProducts} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
