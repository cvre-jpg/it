import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { getBrands, getProductsByBrand } from "@/lib/catalog";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";

export const revalidate = 3600;

export async function generateStaticParams() {
  const brands = await getBrands();
  return brands.slice(0, 250).map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brands = await getBrands();
  const brand = brands.find((item) => item.slug === slug);
  if (!brand) return {};

  return buildMetadata({
    title: buildTitle(`${brand.name} products`),
    description: buildDescription(`Shop ${brand.name} products with fast-loading product detail pages and optimized internal linking.`),
    path: `/brands/${brand.slug}`,
    keywords: [brand.name, `${brand.name} Kenya`, `${brand.name} products`],
  });
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brands = await getBrands();
  const brand = brands.find((item) => item.slug === slug);
  if (!brand) notFound();

  const products = await getProductsByBrand(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="rounded-[32px] border border-black/5 bg-white p-8 shadow-soft">
        <p className="text-sm uppercase tracking-[0.18em] text-black/45">Brand page</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{brand.name}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-black/68">
          Search-friendly brand landing pages help shoppers narrow intent and improve crawl paths to deeper product pages.
        </p>
      </header>
      <section className="mt-8">
        <ProductGrid products={products} />
      </section>
    </div>
  );
}
