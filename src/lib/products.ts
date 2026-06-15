import { createServerFn } from "@tanstack/react-start";
import { CATEGORY_TREE, type MainCategory } from "./category-tree";
import { detectMainCategory, detectSubcategory } from "./catalog-categorization";
import csvCatalogSource from "../data/products.csv?raw";

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  brand: string | null;
  subcategory: string | null;
  subcategories: string[];
  price: number;
  old_price: number | null;
  stock_status: string;
  category_id: string | null;
  images: string[];
  specs: Record<string, string>;
  warranty: string | null;
  featured: boolean;
  category_priority: boolean;
  hidden: boolean;
  badge: string | null;
};

export type ProductSummary = Omit<Product, "description" | "specs" | "warranty">;

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

export type HomepageHeroSlide = {
  title: string;
  description: string;
  image: string;
  url: string;
  ctaLabel?: string;
};

export type HomepageRightBanner = {
  image: string;
  url: string;
};

export type HomepagePopularBanner = {
  image: string;
  url: string;
};

export type HomepageBanners = {
  heroSlides: HomepageHeroSlide[];
  rightBanner: HomepageRightBanner;
  popularBanners: HomepagePopularBanner[];
  shopMobileBanners: HomepagePopularBanner[];
};

function normalizeHomepageHeroSlide(value: unknown): HomepageHeroSlide {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    title: String(record.title ?? ""),
    description: String(record.description ?? ""),
    image: String(record.image ?? ""),
    url: String(record.url ?? ""),
    ctaLabel: String(record.ctaLabel ?? "Shop now"),
  };
}

function normalizeHomepageBannerEntry(value: unknown): HomepagePopularBanner {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    image: String(record.image ?? ""),
    url: String(record.url ?? ""),
  };
}

export function normalizeHomepageBanners(value: unknown): HomepageBanners {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const fallbackPopularBanner = normalizeHomepageBannerEntry(record.popularBanner);
  const popularBannersSource = Array.isArray(record.popularBanners)
    ? record.popularBanners
    : fallbackPopularBanner.image || fallbackPopularBanner.url
      ? [fallbackPopularBanner]
      : [];

  return {
    heroSlides: Array.isArray(record.heroSlides)
      ? record.heroSlides
          .map(normalizeHomepageHeroSlide)
          .filter((slide) => slide.title || slide.description || slide.image || slide.url)
          .slice(0, 3)
      : [],
    rightBanner: normalizeHomepageBannerEntry(record.rightBanner),
    popularBanners: popularBannersSource
      .map(normalizeHomepageBannerEntry)
      .filter((banner) => banner.image || banner.url)
      .slice(0, 2),
    shopMobileBanners: Array.isArray(record.shopMobileBanners)
      ? record.shopMobileBanners
          .map(normalizeHomepageBannerEntry)
          .filter((banner) => banner.image)
          .slice(0, 3)
      : [],
  };
}

type ProductWithCategory = Product & {
  categories?: { slug: string; name: string };
};

export type ProductSummaryWithCategory = ProductSummary & {
  categories?: { slug: string; name: string };
};

type CsvCatalogProduct = ProductWithCategory & {
  created_at: string;
  updated_at: string;
  catalog_order: number;
  searchable_text: string;
};

type CatalogData = {
  products: CsvCatalogProduct[];
  categories: Category[];
};

type FetchProductsOptions = {
  categorySlug?: string;
  featured?: boolean;
  homepageBestDeals?: boolean;
  limit?: number;
  search?: string;
};

type FetchShopProductsOptions = {
  categorySlug?: string;
  subcategory?: string;
  featured?: boolean;
  brands?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "popular" | "price-asc" | "price-desc" | "newest";
};

export type ShopProductsResult = {
  products: ProductSummaryWithCategory[];
  total: number;
  page: number;
  pageSize: number;
};

export type HomepageData = {
  whatsappNumber: string;
  featured: ProductSummaryWithCategory[];
  homepageBanners: HomepageBanners;
  sections: {
    laptops: ShopProductsResult;
    monitors: ShopProductsResult;
    smartphones: ShopProductsResult;
    audio: ShopProductsResult;
    printers: ShopProductsResult;
  };
};

export type ShopPageData = {
  products: ShopProductsResult;
  searchSuggestions: ShopProductsResult | null;
  categorySearchSuggestions: ShopProductsResult | null;
  categorySuggestions: ShopProductsResult | null;
  homepageBanners: HomepageBanners;
};

export type ProductPageData = {
  product: ProductWithCategory | null;
  related: {
    products: ProductSummaryWithCategory[];
    isFallback: boolean;
  };
  whatsappNumber: string;
};

type InquiryInput = {
  customer_name: string | null;
  customer_phone: string | null;
  items: Array<{ id: string; title: string; qty: number; price: number }>;
  total: number;
  message: string;
  analytics?: {
    pathname?: string;
    session_id?: string | null;
    source?: string | null;
    referrer?: string | null;
    device_type?: string | null;
    user_agent?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
};

const SUBCATEGORY_SEPARATOR = " || ";
const CATALOG_CACHE_TTL_MS = 1000 * 60 * 30;
const SETTINGS_CACHE_TTL_MS = 1000 * 60 * 30;
const DEFAULT_WHATSAPP_NUMBER = "+254713869018";

type TimedCache<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

let catalogCache: TimedCache<CatalogData> = { expiresAt: 0 };
let settingsCache: TimedCache<Record<string, unknown>> = { expiresAt: 0 };

export function parseSubcategories(value: string | null | undefined) {
  return String(value ?? "")
    .split(SUBCATEGORY_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stringifySubcategories(values: string[]) {
  const normalized = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  return normalized.length > 0 ? normalized.join(SUBCATEGORY_SEPARATOR) : null;
}

export function normalizeSpecsRecord(specs: Record<string, unknown> | null | undefined) {
  const normalized =
    specs && typeof specs === "object" && !Array.isArray(specs)
      ? Object.fromEntries(Object.entries(specs).map(([key, value]) => [key, String(value)]))
      : {};

  if ("HDD size" in normalized && !("Size" in normalized)) {
    normalized["Size"] = normalized["HDD size"];
  }

  delete normalized["HDD size"];

  return normalized as Record<string, string>;
}

function parseProductRow(row: any): ProductWithCategory {
  const subcategories = parseSubcategories(row.subcategory ?? null);
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: row.description ?? null,
    brand: row.brand ?? null,
    subcategory: subcategories[0] ?? (row.subcategory ?? null),
    subcategories,
    price: Number(row.price ?? 0),
    old_price: row.old_price == null ? null : Number(row.old_price),
    stock_status: String(row.stock_status ?? "in_stock"),
    category_id: row.category_id ?? null,
    images: Array.isArray(row.images) ? row.images.map(String) : [],
    specs: normalizeSpecsRecord(row.specs),
    warranty: row.warranty ?? null,
    featured: Boolean(row.featured),
    category_priority: Boolean(row.category_priority),
    hidden: Boolean(row.is_hidden),
    badge: row.badge ?? null,
    categories:
      row.category_slug && row.category_name
        ? { slug: String(row.category_slug), name: String(row.category_name) }
        : undefined,
  };
}

function summarizeProduct(product: ProductWithCategory): ProductSummaryWithCategory {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    brand: product.brand,
    subcategory: product.subcategory,
    subcategories: product.subcategories,
    price: product.price,
    old_price: product.old_price,
    stock_status: product.stock_status,
    category_id: product.category_id,
    images: product.images,
    featured: product.featured,
    category_priority: product.category_priority,
    hidden: product.hidden,
    badge: product.badge,
    categories: product.categories,
  };
}

function compareCategoryPriority(left: ProductWithCategory, right: ProductWithCategory, enabled: boolean) {
  return enabled ? Number(right.category_priority) - Number(left.category_priority) : 0;
}

const CSV_CATALOG_UPDATED_AT = "1970-01-01T00:00:00.000Z";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsvBoolean(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseCsvNumber(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function splitCommaSeparatedValues(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }

  return null;
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function flattenSearchValue(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(flattenSearchValue);
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entryValue]) => [
      key,
      ...flattenSearchValue(entryValue),
    ]);
  }

  return [String(value)];
}

function buildSearchText(...values: unknown[]) {
  return normalizeSearchText(values.flatMap(flattenSearchValue).join(" "));
}

function getSearchTokens(value: string | null | undefined) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function fuzzyTokenMatches(token: string, searchableText: string) {
  if (token.length < 4) return false;

  let tokenIndex = 0;
  for (let index = 0; index < searchableText.length && tokenIndex < token.length; index += 1) {
    if (searchableText[index] === token[tokenIndex]) tokenIndex += 1;
  }

  return tokenIndex === token.length;
}

function getProductSearchScore(product: CsvCatalogProduct, search: string | null | undefined, requireEveryToken: boolean) {
  const tokens = getSearchTokens(search);
  if (tokens.length === 0) return 1;

  const searchableText = product.searchable_text;
  const words = searchableText.split(" ");
  const normalizedSearch = tokens.join(" ");
  let score = searchableText.includes(normalizedSearch) ? 80 : 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    if (searchableText.includes(token)) {
      matchedTokens += 1;
      score += 20;
      if (words.some((word) => word.startsWith(token))) score += 10;
    } else if (fuzzyTokenMatches(token, searchableText)) {
      matchedTokens += 1;
      score += 6;
    }
  }

  if (requireEveryToken && matchedTokens < tokens.length) return 0;
  if (!requireEveryToken && matchedTokens === 0) return 0;

  if (product.featured) score += 4;
  if (product.badge) score += 2;
  return score;
}

function inferBrand(title: string, brandValue: string | null) {
  if (brandValue) return brandValue;

  const firstWord = title.trim().split(/\s+/)[0] ?? "";
  if (!firstWord) return null;

  return firstWord
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim() || null;
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

  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

function resolveMainCategoryLabel(
  title: string,
  rawCategory: string | null,
  rawTags: string | null,
): MainCategory | null {
  const normalizedCategory = String(rawCategory ?? "").trim();
  const categorySlug = normalizedCategory ? slugify(normalizedCategory.split(">")[0] ?? normalizedCategory) : "";
  const categoryName = normalizedCategory || rawTags || "";
  const detected = detectMainCategory({
    id: "",
    title,
    slug: "",
    description: null,
    brand: null,
    subcategory: null,
    subcategories: [],
    price: 0,
    old_price: null,
    stock_status: "in_stock",
    category_id: null,
    images: [],
    specs: {},
    warranty: null,
    featured: false,
    hidden: false,
    badge: null,
    categories: categoryName ? { slug: categorySlug, name: categoryName } : undefined,
  });

  return detected;
}

function buildCsvCategoryMeta(mainCategory: MainCategory | null) {
  if (!mainCategory) return null;

  const category = CATEGORY_TREE.find((item) => item.label === mainCategory);
  if (!category) return null;

  return {
    id: category.query,
    name: category.label,
    slug: category.query,
    icon: null,
  } satisfies Category;
}

function normalizeCsvProductRow(
  row: Record<string, string>,
  index: number,
  fileUpdatedAt: string,
  usedSlugs: Set<string>,
) {
  const title = firstNonEmpty(row.Name, row.Title);
  if (!title) return null;

  const regularPrice = parseCsvNumber(row["Regular price"]);
  const salePrice = parseCsvNumber(row["Sale price"]);
  const price = salePrice ?? regularPrice ?? 0;
  const oldPrice = regularPrice && salePrice && regularPrice > salePrice ? regularPrice : null;
  const rawCategory = firstNonEmpty(row.Categories);
  const rawTags = firstNonEmpty(row.Tags);
  const mainCategory = resolveMainCategoryLabel(title, rawCategory, rawTags);
  const categoryMeta = buildCsvCategoryMeta(mainCategory);
  const brand = inferBrand(title, firstNonEmpty(row.Brands));
  const subcategory =
    mainCategory && title
      ? detectSubcategory(mainCategory, `${title} ${rawCategory ?? ""}`)
      : null;
  const subcategories = subcategory ? [subcategory] : [];
  const images = splitCommaSeparatedValues(row.Images);
  const published = parseCsvBoolean(row.Published);
  const visible = String(row["Visibility in catalog"] ?? "").trim().toLowerCase() !== "hidden";
  const inStock = parseCsvBoolean(row["In stock?"]) || (parseCsvNumber(row.Stock) ?? 0) > 0;
  const rawId = firstNonEmpty(row.ID) ?? `csv-${index + 1}`;
  const baseSlug = slugify(title) || `product-${index + 1}`;
  let slug = baseSlug;
  let duplicateCounter = 2;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${duplicateCounter}`;
    duplicateCounter += 1;
  }
  usedSlugs.add(slug);

  const specs = Object.fromEntries(
    [
      ["SKU", firstNonEmpty(row.SKU)],
      ["Type", firstNonEmpty(row.Type)],
      ["Categories", rawCategory],
      ["Tags", rawTags],
      ["GTIN", firstNonEmpty(row["GTIN, UPC, EAN, or ISBN"])],
      ["Weight (kg)", firstNonEmpty(row["Weight (kg)"])],
      ["Length (cm)", firstNonEmpty(row["Length (cm)"])],
      ["Width (cm)", firstNonEmpty(row["Width (cm)"])],
      ["Height (cm)", firstNonEmpty(row["Height (cm)"])],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    id: String(rawId),
    title,
    slug,
    description: firstNonEmpty(row.Description, row["Short description"]),
    brand,
    subcategory,
    subcategories,
    price,
    old_price: oldPrice,
    stock_status: inStock ? "in_stock" : "out_of_stock",
    category_id: categoryMeta?.id ?? null,
    images,
    specs,
    warranty: null,
    featured: parseCsvBoolean(row["Is featured?"]),
    hidden: !published || !visible,
    badge: oldPrice ? "Sale" : parseCsvBoolean(row["Is featured?"]) ? "Featured" : null,
    categories: categoryMeta ? { slug: categoryMeta.slug, name: categoryMeta.name } : undefined,
    created_at: fileUpdatedAt,
    updated_at: fileUpdatedAt,
    catalog_order: index,
    searchable_text: buildSearchText(
      title,
      brand,
      rawCategory,
      rawTags,
      subcategory,
      subcategories,
      price,
      oldPrice,
      inStock ? "in stock available" : "out of stock unavailable",
      specs,
      firstNonEmpty(row.Description, row["Short description"]),
      row.SKU,
      row.Type,
      row["GTIN, UPC, EAN, or ISBN"],
    ),
  } satisfies CsvCatalogProduct;
}

async function loadCsvCatalog() {
  const csvRows = parseCsvDocument(csvCatalogSource);
  const headers = csvRows[0] ?? [];
  const records = csvRows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, headerIndex) => [header, cells[headerIndex] ?? ""])),
  );
  const usedSlugs = new Set<string>();
  const products = records
    .map((row, index) => normalizeCsvProductRow(row, index, CSV_CATALOG_UPDATED_AT, usedSlugs))
    .filter((product): product is CsvCatalogProduct => Boolean(product));
  const categories = CATEGORY_TREE.map((category) => ({
    id: category.query,
    name: category.label,
    slug: category.query,
    icon: null,
  })).filter((category) =>
    products.some((product) => product.categories?.slug === category.slug && !product.hidden),
  );

  return { products, categories };
}

function isCacheFresh<T>(cache: TimedCache<T>) {
  return cache.value !== undefined && cache.expiresAt > Date.now();
}

async function resolveCachedValue<T>(
  cache: TimedCache<T>,
  cacheTtlMs: number,
  loadFresh: () => Promise<T>,
  onErrorFallback: (error: unknown) => Promise<T> | T,
) {
  if (isCacheFresh(cache)) {
    return cache.value as T;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async () => {
    try {
      const freshValue = await loadFresh();
      cache.value = freshValue;
      cache.expiresAt = Date.now() + cacheTtlMs;
      return freshValue;
    } catch (error) {
      console.error(error);

      if (cache.value !== undefined) {
        // Prefer a slightly stale in-memory snapshot over taking down the storefront.
        cache.expiresAt = Date.now() + Math.min(cacheTtlMs, 5_000);
        return cache.value;
      }

      const fallbackValue = await onErrorFallback(error);
      cache.value = fallbackValue;
      cache.expiresAt = Date.now() + Math.min(cacheTtlMs, 5_000);
      return fallbackValue;
    } finally {
      cache.promise = undefined;
    }
  })();

  return cache.promise;
}

async function loadStoredCatalog() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  const productRows = await sql`
    select
      p.*,
      c.name as category_name,
      c.slug as category_slug
    from products p
    left join categories c on c.id = p.category_id
    order by p.created_at desc
  `;

  const products = productRows.map((row: any, index: number) => ({
    ...parseProductRow(row),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
    catalog_order: index,
    searchable_text: buildSearchText(
      row.title,
      row.brand,
      row.category_name,
      row.category_slug,
      row.slug,
      row.subcategory,
      row.price,
      row.old_price,
      row.stock_status,
      row.badge,
      row.warranty,
      row.description,
      row.specs,
      row.images,
      parseSubcategories(row.subcategory ?? null),
    ),
  })) as CsvCatalogProduct[];

  const visibleCategorySlugs = new Set(
    products
      .filter((product) => !product.hidden && product.categories?.slug)
      .map((product) => product.categories!.slug),
  );

  const categoryRows = await sql`
    select id, name, slug, icon
    from categories
    order by sort_order asc, created_at asc
  `;

  const categories = categoryRows
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      icon: row.icon ?? null,
    }))
    .filter((category) => visibleCategorySlugs.has(category.slug));

  return { products, categories };
}

async function loadCatalog() {
  return resolveCachedValue(
    catalogCache,
    CATALOG_CACHE_TTL_MS,
    () => loadStoredCatalog(),
    async () => {
      console.warn("Falling back to bundled CSV catalog after catalog fetch failed.");
      return loadCsvCatalog();
    },
  );
}

async function loadSettingsMap() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  return resolveCachedValue(
    settingsCache,
    SETTINGS_CACHE_TTL_MS,
    async () => {
      const rows = await sql`
        select key, value
        from settings
      `;

      return Object.fromEntries(
        rows.map((row: any) => [String(row.key), row.value]),
      ) as Record<string, unknown>;
    },
    () => {
      console.warn("Falling back to default settings after settings fetch failed.");
      return {};
    },
  );
}

async function fetchManualBestDealProductSlugs() {
  const settings = await loadSettingsMap();
  const value = settings.homepage_best_deal_product_slugs;
  return Array.isArray(value) ? value.map((item: any) => String(item).trim()).filter(Boolean) : [];
}

function getHomepageBannersFromSettings(settings: Record<string, unknown>) {
  return normalizeHomepageBanners({
    heroSlides: settings.homepage_hero_slides,
    rightBanner: settings.homepage_right_banner,
    popularBanner: settings.homepage_popular_banner,
    popularBanners: settings.homepage_popular_banners,
    shopMobileBanners: settings.shop_mobile_carousel_banners,
  });
}

function getWhatsAppNumberFromSettings(settings: Record<string, unknown>) {
  const value = settings.whatsapp_number;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) return String(value);
  return DEFAULT_WHATSAPP_NUMBER;
}

async function getProducts(opts: FetchProductsOptions = {}) {
  const { products } = await loadCatalog();
  const hasSearch = getSearchTokens(opts.search).length > 0;
  const manualBestDealSlugs = opts.homepageBestDeals ? await fetchManualBestDealProductSlugs() : [];
  const manualBestDealSlugSet = new Set(manualBestDealSlugs);

  const filteredProducts = products
    .filter((product) => !product.hidden)
    .filter((product) => (opts.featured == null ? true : product.featured === Boolean(opts.featured)))
    .filter((product) => (opts.homepageBestDeals ? manualBestDealSlugSet.has(product.slug) : true))
    .filter((product) => (opts.categorySlug ? product.categories?.slug === opts.categorySlug : true))
    .map((product) => ({ product, score: getProductSearchScore(product, opts.search, true) }))
    .filter((item) => (hasSearch ? item.score > 0 : true));

  const searchResults = hasSearch && filteredProducts.length === 0
    ? products
        .filter((product) => !product.hidden)
        .filter((product) => (opts.featured == null ? true : product.featured === Boolean(opts.featured)))
        .filter((product) => (opts.homepageBestDeals ? manualBestDealSlugSet.has(product.slug) : true))
        .filter((product) => (opts.categorySlug ? product.categories?.slug === opts.categorySlug : true))
        .map((product) => ({ product, score: getProductSearchScore(product, opts.search, false) }))
        .filter((item) => item.score > 0)
    : filteredProducts;

  return searchResults
    .sort((left, right) => {
      const prioritySort = compareCategoryPriority(left.product, right.product, Boolean(opts.categorySlug));
      if (hasSearch) return right.score - left.score || prioritySort || left.product.catalog_order - right.product.catalog_order;
      return prioritySort || left.product.catalog_order - right.product.catalog_order;
    })
    .slice(0, opts.limit ?? 200)
    .map((item) => summarizeProduct(item.product));
}

async function getShopProducts(opts: FetchShopProductsOptions = {}) {
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const pageSize = Math.min(40, Math.max(1, Number(opts.pageSize ?? 20) || 20));
  const offset = (page - 1) * pageSize;
  const { products } = await loadCatalog();
  const hasSearch = getSearchTokens(opts.search).length > 0;
  const subcategoryTerm = opts.subcategory?.trim().toLowerCase();
  const selectedBrands = new Set(
    (opts.brands ?? [])
      .map((brand) => normalizeSearchText(brand))
      .filter(Boolean),
  );
  const minPrice = opts.minPrice == null ? null : Number(opts.minPrice);
  const maxPrice = opts.maxPrice == null ? null : Number(opts.maxPrice);

  const baseProducts = products
    .filter((product) => !product.hidden)
    .filter((product) => (opts.featured == null ? true : product.featured === Boolean(opts.featured)))
    .filter((product) => (opts.categorySlug ? product.categories?.slug === opts.categorySlug : true))
    .filter((product) => (selectedBrands.size > 0 ? selectedBrands.has(normalizeSearchText(product.brand)) : true))
    .filter((product) => (minPrice == null || !Number.isFinite(minPrice) ? true : product.price >= minPrice))
    .filter((product) => (maxPrice == null || !Number.isFinite(maxPrice) ? true : product.price <= maxPrice))
    .filter((product) =>
      subcategoryTerm
        ? product.subcategories.some((subcategory) => subcategory.toLowerCase() === subcategoryTerm)
        : true,
    );

  const exactSearchProducts = baseProducts
    .map((product) => ({ product, score: getProductSearchScore(product, opts.search, true) }))
    .filter((item) => (hasSearch ? item.score > 0 : true));
  const scoredProducts =
    hasSearch && exactSearchProducts.length === 0
      ? baseProducts
          .map((product) => ({ product, score: getProductSearchScore(product, opts.search, false) }))
          .filter((item) => item.score > 0)
      : exactSearchProducts;

  const total = scoredProducts.length;
  const sortedProducts = [...scoredProducts].sort((left, right) => {
    if (hasSearch && right.score !== left.score) return right.score - left.score;
    const prioritySort = compareCategoryPriority(left.product, right.product, Boolean(opts.categorySlug));
    if (prioritySort !== 0) return prioritySort;
    if (opts.sortBy === "price-asc") return left.product.price - right.product.price || left.product.catalog_order - right.product.catalog_order;
    if (opts.sortBy === "price-desc") return right.product.price - left.product.price || left.product.catalog_order - right.product.catalog_order;
    if (opts.sortBy === "popular") {
      return (
        Number(right.product.featured) - Number(left.product.featured) ||
        Number(Boolean(right.product.badge)) - Number(Boolean(left.product.badge)) ||
        left.product.catalog_order - right.product.catalog_order
      );
    }

    return left.product.catalog_order - right.product.catalog_order;
  });

  return {
    products: sortedProducts.slice(offset, offset + pageSize).map((item) => summarizeProduct(item.product)),
    total,
    page,
    pageSize,
  } satisfies ShopProductsResult;
}

type ProductSimilarityRecord = Pick<ProductWithCategory, "id" | "title" | "slug" | "brand" | "subcategory" | "subcategories" | "categories" | "price">;

function normalizeSimilarityValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function buildProductSimilarityScore(current: ProductSimilarityRecord, candidate: ProductSimilarityRecord) {
  let score = 0;

  if (current.categories?.slug && current.categories.slug === candidate.categories?.slug) {
    score += 4;
  }

  const currentSubcategories = new Set(
    [current.subcategory, ...current.subcategories].map(normalizeSimilarityValue).filter(Boolean),
  );
  const candidateSubcategories = [candidate.subcategory, ...candidate.subcategories]
    .map(normalizeSimilarityValue)
    .filter(Boolean);

  if (candidateSubcategories.some((subcategory) => currentSubcategories.has(subcategory))) {
    score += 3;
  }

  if (normalizeSimilarityValue(current.brand) && normalizeSimilarityValue(current.brand) === normalizeSimilarityValue(candidate.brand)) {
    score += 2;
  }

  return score;
}

async function getRelatedProducts(product: ProductWithCategory | null) {
  if (!product) return { products: [], isFallback: false };

  const catalogProducts = await getProducts({ limit: 200 });
  const similarProducts = catalogProducts
    .filter((item) => item.id !== product.id)
    .map((item) => ({ item, score: buildProductSimilarityScore(product, item) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item)
    .slice(0, 8);

  if (similarProducts.length > 0) {
    return { products: similarProducts, isFallback: false };
  }

  return {
    products: catalogProducts.filter((item) => item.id !== product.id).slice(0, 8),
    isFallback: true,
  };
}

const fetchProductsServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  return getProducts((data ?? {}) as FetchProductsOptions);
});

const fetchShopProductsServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  return getShopProducts((data ?? {}) as FetchShopProductsOptions);
});

const fetchHomepageDataServer = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await loadSettingsMap();

  const [featured, laptops, monitors, smartphones, audio, printers] = await Promise.all([
    getProducts({ homepageBestDeals: true, limit: 15 }),
    getShopProducts({ categorySlug: "laptops", sortBy: "popular", pageSize: 20 }),
    getShopProducts({ categorySlug: "monitors", sortBy: "popular", pageSize: 20 }),
    getShopProducts({ categorySlug: "smartphones", sortBy: "popular", pageSize: 20 }),
    getShopProducts({ categorySlug: "audio", sortBy: "popular", pageSize: 20 }),
    getShopProducts({ categorySlug: "printers", sortBy: "popular", pageSize: 20 }),
  ]);

  return {
    whatsappNumber: getWhatsAppNumberFromSettings(settings),
    featured,
    homepageBanners: getHomepageBannersFromSettings(settings),
    sections: {
      laptops,
      monitors,
      smartphones,
      audio,
      printers,
    },
  } satisfies HomepageData;
});

const fetchShopPageDataServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const opts = (data ?? {}) as {
    products: FetchShopProductsOptions;
    searchSuggestions?: FetchShopProductsOptions | null;
    categorySearchSuggestions?: FetchShopProductsOptions | null;
    categorySuggestions?: FetchShopProductsOptions | null;
  };
  const settings = await loadSettingsMap();
  const [products, searchSuggestions, categorySearchSuggestions, categorySuggestions] = await Promise.all([
    getShopProducts(opts.products ?? {}),
    opts.searchSuggestions ? getShopProducts(opts.searchSuggestions) : Promise.resolve(null),
    opts.categorySearchSuggestions ? getShopProducts(opts.categorySearchSuggestions) : Promise.resolve(null),
    opts.categorySuggestions ? getShopProducts(opts.categorySuggestions) : Promise.resolve(null),
  ]);

  return {
    products,
    searchSuggestions,
    categorySearchSuggestions,
    categorySuggestions,
    homepageBanners: getHomepageBannersFromSettings(settings),
  } satisfies ShopPageData;
});

const fetchProductBySlugServer = createServerFn({ method: "GET" }).handler(async ({ data }) => {
  const slug = String((data as { slug?: string } | undefined)?.slug ?? "");
  const { products } = await loadCatalog();

  return products.find((product) => product.slug === slug && !product.hidden) ?? null;
});

const fetchProductPageDataServer = createServerFn({ method: "GET" }).handler(async ({ data }) => {
  const slug = String((data as { slug?: string } | undefined)?.slug ?? "");
  const [catalog, settings] = await Promise.all([loadCatalog(), loadSettingsMap()]);
  const product = catalog.products.find((item) => item.slug === slug && !item.hidden) ?? null;

  return {
    product,
    related: await getRelatedProducts(product),
    whatsappNumber: getWhatsAppNumberFromSettings(settings),
  } satisfies ProductPageData;
});

const fetchCategoriesServer = createServerFn({ method: "GET" }).handler(async () => {
  const { categories } = await loadCatalog();
  return categories;
});

const fetchWhatsAppNumberServer = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await loadSettingsMap();
  return getWhatsAppNumberFromSettings(settings);
});

const fetchHomepageBannersServer = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await loadSettingsMap();
  return getHomepageBannersFromSettings(settings);
});

const submitInquiryServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();
  const inquiry = data as InquiryInput;
  const { trackAnalyticsEvent } = await import("./analytics");

  await sql`
    insert into inquiries (customer_name, customer_phone, items, total, message)
    values (
      ${inquiry.customer_name},
      ${inquiry.customer_phone},
      ${JSON.stringify(inquiry.items)}::jsonb,
      ${inquiry.total},
      ${inquiry.message}
    )
  `;

  if (inquiry.analytics) {
    await trackAnalyticsEvent({
      event_type: "inquiry_submitted",
      pathname: inquiry.analytics.pathname || "/cart",
      session_id: inquiry.analytics.session_id ?? null,
      source: inquiry.analytics.source ?? null,
      referrer: inquiry.analytics.referrer ?? null,
      device_type: inquiry.analytics.device_type ?? null,
      user_agent: inquiry.analytics.user_agent ?? null,
      metadata: {
        ...(inquiry.analytics.metadata ?? {}),
        items_count: inquiry.items.length,
        order_total: inquiry.total,
      },
    });
  }

  return { ok: true };
});

export async function fetchProducts(opts?: FetchProductsOptions) {
  return fetchProductsServer({ data: opts ?? {} }) as Promise<ProductSummaryWithCategory[]>;
}

export async function fetchShopProducts(opts?: FetchShopProductsOptions) {
  return fetchShopProductsServer({ data: opts ?? {} }) as Promise<ShopProductsResult>;
}

export async function fetchProductBySlug(slug: string) {
  return fetchProductBySlugServer({ data: { slug } }) as Promise<ProductWithCategory | null>;
}

export async function fetchProductPageData(slug: string) {
  return fetchProductPageDataServer({ data: { slug } }) as Promise<ProductPageData>;
}

export async function fetchCategories() {
  return fetchCategoriesServer() as Promise<Category[]>;
}

export async function fetchWhatsAppNumber() {
  return fetchWhatsAppNumberServer() as Promise<string>;
}

export async function fetchHomepageBanners() {
  return fetchHomepageBannersServer() as Promise<HomepageBanners>;
}

export async function fetchHomepageData() {
  return fetchHomepageDataServer() as Promise<HomepageData>;
}

export async function fetchShopPageData(input: {
  products: FetchShopProductsOptions;
  searchSuggestions?: FetchShopProductsOptions | null;
  categorySearchSuggestions?: FetchShopProductsOptions | null;
  categorySuggestions?: FetchShopProductsOptions | null;
}) {
  return fetchShopPageDataServer({ data: input }) as Promise<ShopPageData>;
}

export async function submitInquiry(input: InquiryInput) {
  return submitInquiryServer({ data: input }) as Promise<{ ok: true }>;
}
