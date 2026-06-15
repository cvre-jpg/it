import { ProductGrid } from "@/components/product-grid";
import { searchProducts } from "@/lib/catalog";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";

export const revalidate = 1800;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  return buildMetadata({
    title: buildTitle(query ? `Search results for ${query}` : "Search products"),
    description: buildDescription(query ? `Search results for ${query} across our electronics catalog.` : "Search fast electronics listings."),
    path: query ? `/search?q=${encodeURIComponent(query)}` : "/search",
  });
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = q.trim() ? await searchProducts(q, 24) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">Search products</h1>
      <p className="mt-4 text-base leading-7 text-black/68">
        {q.trim() ? `Showing results for "${q}".` : "Use product names, brands, or categories to discover matching items."}
      </p>
      <form action="/search" className="mt-6 max-w-2xl">
        <label className="sr-only" htmlFor="search-page-query">
          Search products
        </label>
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f7f4] p-1">
          <input
            id="search-page-query"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by title, brand, or category"
            className="h-11 w-full bg-transparent px-4 text-sm outline-none placeholder:text-black/35"
          />
          <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">
            Search
          </button>
        </div>
      </form>
      <div className="mt-8">
        <ProductGrid products={results} />
      </div>
    </div>
  );
}
