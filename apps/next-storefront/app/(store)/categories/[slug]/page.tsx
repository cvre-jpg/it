import { notFound } from "next/navigation";
import { BreadcrumbTrail } from "@/components/breadcrumb-trail";
import { ProductGrid } from "@/components/product-grid";
import { JsonLd } from "@/components/json-ld";
import { getCatalog, getCategories, getProductsByCategory } from "@/lib/catalog";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";

export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) return {};

  return buildMetadata({
    title: buildTitle(`${category.name} in Kenya`),
    description: buildDescription(category.description),
    path: `/categories/${category.slug}`,
    keywords: [category.name, `${category.name} Kenya`, `buy ${category.name.toLowerCase()} online`],
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const products = await getProductsByCategory(slug);
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Categories", href: "/" },
    { name: category.name, href: `/categories/${category.slug}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <BreadcrumbTrail items={breadcrumbs} />
      <header className="mt-6 rounded-[32px] border border-black/5 bg-white p-8 shadow-soft">
        <p className="text-sm uppercase tracking-[0.18em] text-black/45">Category landing page</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{category.name}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-black/68">{category.description}</p>
      </header>
      <section className="mt-8">
        <ProductGrid products={products} />
      </section>
    </div>
  );
}
