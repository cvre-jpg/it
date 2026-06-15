import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { ProductGrid } from "@/components/product-grid";
import { getCategories, getFeaturedProducts, getTrendingProducts } from "@/lib/catalog";
import { getOptimizedImageUrl, getProductAlt } from "@/lib/images";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";
import { faqSchema } from "@/lib/schema";
import { shimmer, toBase64 } from "@/lib/utils";

export const revalidate = 3600;

const faqs = [
  {
    question: "How do category pages help SEO?",
    answer: "Well-structured category pages consolidate internal links, create stronger topical relevance, and help search engines crawl large catalogs efficiently.",
  },
  {
    question: "Why are product pages statically regenerated?",
    answer: "ISR keeps product pages extremely fast while still allowing stock, pricing, and content updates without full rebuilds.",
  },
];

export const metadata = buildMetadata({
  title: buildTitle("Premium electronics for work, gaming, and business"),
  description: buildDescription("Shop premium gadgets with fast-loading product pages, rich structured data, and clean category navigation."),
  path: "/",
  keywords: ["electronics kenya", "laptops kenya", "monitors kenya", "gadgets online"],
});

export default async function HomePage() {
  const [featuredProducts, trendingProducts, categories] = await Promise.all([
    getFeaturedProducts(8),
    getTrendingProducts(8),
    getCategories(),
  ]);

  const heroProduct = featuredProducts[0] ?? trendingProducts[0] ?? null;
  const heroImage = getOptimizedImageUrl(heroProduct?.images[0], { width: 1200, height: 900 });

  return (
    <>
      <JsonLd data={faqSchema(faqs)} />
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-black/5 bg-white/90 p-8 shadow-soft">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-accent">SEO-engineered commerce</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Premium electronics with fast storefront performance and rich product discovery.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-black/68 sm:text-lg">
              Browse laptops, monitors, phones, accessories, and display solutions inside a lightweight storefront designed for excellent Core Web Vitals, clean indexing, and strong conversion flow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/categories/laptops" className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white">
                Shop laptops
              </Link>
              <Link href="/categories/monitors" className="rounded-full border border-black/10 bg-[#f8f7f4] px-5 py-3 text-sm font-medium text-ink">
                Explore monitors
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            {heroProduct ? (
              <Link
                href={`/products/${heroProduct.slug}`}
                className="group overflow-hidden rounded-[28px] border border-black/5 bg-[#fbfaf7] shadow-soft"
              >
                <div className="relative aspect-[4/3] bg-sand">
                  {heroImage ? (
                    <Image
                      src={heroImage}
                      alt={getProductAlt(heroProduct.title, heroProduct.brand)}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 38vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      placeholder="blur"
                      blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(1200, 900))}`}
                    />
                  ) : null}
                </div>
                <div className="p-6">
                  <div className="text-xs uppercase tracking-[0.18em] text-black/45">Priority featured product</div>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{heroProduct.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-black/65">
                    Fast-loading imagery, clean metadata, and strong internal linking from the homepage hero.
                  </p>
                </div>
              </Link>
            ) : null}
            {categories.slice(0, 2).map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="rounded-[28px] border border-black/5 bg-[#fbfaf7] p-6 transition hover:-translate-y-0.5"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-black/45">Featured category</div>
                <h2 className="mt-2 text-2xl font-semibold text-ink">{category.name}</h2>
                <p className="mt-3 text-sm leading-6 text-black/65">{category.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Trending products</h2>
            <p className="mt-2 text-sm text-black/65">High-intent listings optimized for both shoppers and search engines.</p>
          </div>
        </div>
        <ProductGrid products={trendingProducts} />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Featured deals</h2>
            <p className="mt-2 text-sm text-black/65">ISR-powered deal pages ready for rich snippets, internal linking, and fast mobile rendering.</p>
          </div>
        </div>
        <ProductGrid products={featuredProducts} />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-soft">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">FAQ</h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-3xl border border-black/5 bg-[#faf8f4] p-5">
                <h3 className="text-base font-semibold text-ink">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-black/68">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
