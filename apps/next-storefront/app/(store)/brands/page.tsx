import Link from "next/link";
import { getBrands } from "@/lib/catalog";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: buildTitle("Browse brands"),
  description: buildDescription("Discover technology brands with clean indexable landing pages and optimized product collections."),
  path: "/brands",
});

export default async function BrandsIndexPage() {
  const brands = await getBrands();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">Brands</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-black/68">
        Crawlable brand hubs help users compare trusted manufacturers while strengthening semantic product discovery.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {brands.map((brand) => (
          <Link key={brand.slug} href={`/brands/${brand.slug}`} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">{brand.name}</h2>
            <p className="mt-2 text-sm text-black/55">{brand.productCount} products</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
