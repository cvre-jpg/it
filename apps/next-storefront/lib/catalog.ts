import { neon } from "@neondatabase/serverless";
import { unstable_cache } from "next/cache";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "@/lib/utils";
import type { Brand, Category, Product } from "@/lib/types";

type QueryCatalogRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  brand: string | null;
  subcategory: string | null;
  price: number;
  old_price: number | null;
  stock_status: string;
  images: string[] | null;
  specs: Record<string, unknown> | null;
  featured: boolean;
  hidden?: boolean;
  badge: string | null;
  category_name: string | null;
  category_slug: string | null;
};

const SUBCATEGORY_SEPARATOR = " || ";
const CSV_SOURCE = path.resolve(process.cwd(), "..", "..", "src", "data", "products.csv");
const CATALOG_REVALIDATE_SECONDS = 3600;
const SEARCH_REVALIDATE_SECONDS = 300;

function getSql() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  return neon(connectionString);
}

function parseSubcategories(value: string | null | undefined) {
  return String(value ?? "")
    .split(SUBCATEGORY_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSpecs(specs: Record<string, unknown> | null | undefined) {
  const base =
    specs && typeof specs === "object" && !Array.isArray(specs)
      ? Object.fromEntries(Object.entries(specs).map(([key, value]) => [key, String(value)]))
      : {};

  if ("HDD size" in base && !("Size" in base)) {
    base["Size"] = base["HDD size"];
  }

  delete base["HDD size"];

  return base as Record<string, string>;
}

function toProduct(row: QueryCatalogRow): Product {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: row.description ?? null,
    brand: row.brand ?? null,
    categorySlug: row.category_slug ?? null,
    categoryName: row.category_name ?? null,
    subcategories: parseSubcategories(row.subcategory),
    price: Number(row.price ?? 0),
    oldPrice: row.old_price == null ? null : Number(row.old_price),
    stockStatus: row.stock_status ?? "in_stock",
    images: Array.isArray(row.images) ? row.images.map(String) : [],
    specs: normalizeSpecs(row.specs),
    featured: Boolean(row.featured),
    hidden: Boolean(row.hidden),
    badge: row.badge ?? null,
    rating: null,
    reviewCount: null,
  };
}

function parseCsvDocument(source: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") index += 1;
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function categoryDescription(name: string) {
  return `${name} at Shop ICT Gadgets with optimized product listings, helpful filters, and SEO-rich technical details.`;
}

const readCsvCatalog = unstable_cache(
  async () => {
    const csv = await readFile(CSV_SOURCE, "utf8");
    const [headerRow, ...dataRows] = parseCsvDocument(csv);
    const headers = headerRow.map((value) => value.trim());

    const products = dataRows
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
      .map((row) => {
        const categoryName = String(row.category || row.category_name || "").trim() || "General";
        const categorySlug = slugify(categoryName);
        const subcategories = String(row.subcategory || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const specs = (() => {
          try {
            return JSON.parse(String(row.specs || "{}"));
          } catch {
            return {};
          }
        })();

        return {
          id: String(row.id || row.slug || row.title),
          title: String(row.title || ""),
          slug: String(row.slug || slugify(String(row.title || ""))),
          description: String(row.description || "").trim() || null,
          brand: String(row.brand || "").trim() || null,
          categorySlug,
          categoryName,
          subcategories,
          price: Number(String(row.price || "0").replace(/,/g, "")) || 0,
          oldPrice: Number(String(row.old_price || "0").replace(/,/g, "")) || null,
          stockStatus: String(row.stock_status || "in_stock"),
          images: String(row.images || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          specs: normalizeSpecs(specs),
          featured: /^(1|true|yes)$/i.test(String(row.featured || "")),
          hidden: /^(1|true|yes)$/i.test(String(row.hidden || row.is_hidden || "")),
          badge: String(row.badge || "").trim() || null,
          rating: null,
          reviewCount: null,
        } satisfies Product;
      })
      .filter((product) => product.title && !product.hidden);

    const categoryMap = new Map<string, Category>();
    for (const product of products) {
      if (!product.categorySlug || !product.categoryName) continue;
      if (!categoryMap.has(product.categorySlug)) {
        categoryMap.set(product.categorySlug, {
          id: product.categorySlug,
          slug: product.categorySlug,
          name: product.categoryName,
          description: categoryDescription(product.categoryName),
        });
      }
    }

    return {
      products,
      categories: Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
  ["catalog-csv"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

const queryCatalog = unstable_cache(
  async () => {
    const sql = getSql();
    if (!sql) return null;

    const rows = (await sql`
      select
        p.id,
        p.title,
        p.slug,
        p.description,
        p.brand,
        p.subcategory,
        p.price,
        p.old_price,
        p.stock_status,
        p.images,
        p.specs,
        p.featured,
        p.badge,
        p.hidden as hidden,
        c.name as category_name,
        c.slug as category_slug
      from products p
      left join categories c on c.id = p.category_id
      where coalesce(p.hidden, false) = false
      order by p.featured desc, p.created_at desc nulls last, p.title asc
    `) as QueryCatalogRow[];

    const products = rows.map(toProduct);
    const categoryMap = new Map<string, Category>();
    for (const product of products) {
      if (!product.categorySlug || !product.categoryName) continue;
      if (!categoryMap.has(product.categorySlug)) {
        categoryMap.set(product.categorySlug, {
          id: product.categorySlug,
          slug: product.categorySlug,
          name: product.categoryName,
          description: categoryDescription(product.categoryName),
        });
      }
    }

    return {
      products,
      categories: Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
  ["catalog-db"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export async function getCatalog() {
  return (await queryCatalog()) ?? (await readCsvCatalog());
}

const getCategoriesCached = unstable_cache(
  async () => {
    const catalog = await getCatalog();
    return catalog.categories;
  },
  ["catalog-categories"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getCategories() {
  return getCategoriesCached();
}

const getBrandsCached = unstable_cache(
  async () => {
    const catalog = await getCatalog();
    const counts = new Map<string, number>();
    for (const product of catalog.products) {
      const brand = product.brand?.trim();
      if (!brand) continue;
      counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, productCount]) => ({ name, productCount, slug: slugify(name) } satisfies Brand))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  ["catalog-brands"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getBrands() {
  return getBrandsCached();
}

const getFeaturedProductsCached = unstable_cache(
  async (limit = 8) => {
    const catalog = await getCatalog();
    return catalog.products.filter((product) => product.featured).slice(0, limit);
  },
  ["catalog-featured-products"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getFeaturedProducts(limit = 8) {
  return getFeaturedProductsCached(limit);
}

const getTrendingProductsCached = unstable_cache(
  async (limit = 8) => {
    const catalog = await getCatalog();
    return [...catalog.products]
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.price - a.price)
      .slice(0, limit);
  },
  ["catalog-trending-products"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getTrendingProducts(limit = 8) {
  return getTrendingProductsCached(limit);
}

const getProductBySlugCached = unstable_cache(
  async (slug: string) => {
    const catalog = await getCatalog();
    return catalog.products.find((product) => product.slug === slug) ?? null;
  },
  ["catalog-product-by-slug"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getProductBySlug(slug: string) {
  return getProductBySlugCached(slug);
}

const getProductsByCategoryCached = unstable_cache(
  async (categorySlug: string) => {
    const catalog = await getCatalog();
    return catalog.products.filter((product) => product.categorySlug === categorySlug);
  },
  ["catalog-products-by-category"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getProductsByCategory(categorySlug: string) {
  return getProductsByCategoryCached(categorySlug);
}

const getProductsByBrandCached = unstable_cache(
  async (brandSlug: string) => {
    const catalog = await getCatalog();
    return catalog.products.filter((product) => slugify(product.brand ?? "") === brandSlug);
  },
  ["catalog-products-by-brand"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function getProductsByBrand(brandSlug: string) {
  return getProductsByBrandCached(brandSlug);
}

const searchProductsCached = unstable_cache(
  async (query: string, limit = 10) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [] as Product[];

    const sql = getSql();
    if (sql) {
      const rows = (await sql`
        select
          p.id,
          p.title,
          p.slug,
          p.description,
          p.brand,
          p.subcategory,
          p.price,
          p.old_price,
          p.stock_status,
          p.images,
          p.specs,
          p.featured,
          p.badge,
          p.hidden as hidden,
          c.name as category_name,
          c.slug as category_slug
        from products p
        left join categories c on c.id = p.category_id
        where coalesce(p.hidden, false) = false
          and to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.subcategory, ''))
            @@ plainto_tsquery('simple', ${normalizedQuery})
        order by p.featured desc, p.title asc
        limit ${limit}
      `) as QueryCatalogRow[];

      return rows.map(toProduct);
    }

    const catalog = await getCatalog();
    return catalog.products
      .filter((product) =>
        [product.title, product.brand, product.categoryName, ...product.subcategories]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, limit);
  },
  ["catalog-search-products"],
  { revalidate: SEARCH_REVALIDATE_SECONDS, tags: ["catalog"] },
);

export function searchProducts(query: string, limit = 10) {
  return searchProductsCached(query, limit);
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const catalog = await getCatalog();
  return catalog.products
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.categorySlug === product.categorySlug) score += 4;
      if (candidate.brand && product.brand && candidate.brand === product.brand) score += 3;
      if (candidate.subcategories.some((subcategory) => product.subcategories.includes(subcategory))) score += 2;
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
