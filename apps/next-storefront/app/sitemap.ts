import type { MetadataRoute } from "next";
import { getBrands, getCatalog, getCategories } from "@/lib/catalog";
import { getAllPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, categories, brands] = await Promise.all([getCatalog(), getCategories(), getBrands()]);
  const posts = getAllPosts();
  const now = new Date();

  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/brands"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...categories.map((category) => ({
      url: absoluteUrl(`/categories/${category.slug}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...brands.map((brand) => ({
      url: absoluteUrl(`/brands/${brand.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...catalog.products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
