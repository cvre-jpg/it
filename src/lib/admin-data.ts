import { createServerFn } from "@tanstack/react-start";
import { adminOnly } from "./admin-guard";

type ProductInput = {
  id?: string;
  catalogue_id?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  subcategory?: string | null;
  price: number;
  old_price?: number | null;
  stock_status: string;
  category_id?: string | null;
  images: string[];
  specs?: Record<string, string>;
  featured: boolean;
  hidden?: boolean;
  badge?: string | null;
  warranty?: string | null;
};

type CatalogueVariantInput = {
  specs: Record<string, string>;
};

type ProductCatalogueBatchInput = {
  title: string;
  item: string;
  variants: CatalogueVariantInput[];
  actor?: unknown;
};

type ProductCatalogueUpdateInput = {
  id: string;
  title: string;
  item: string;
  specs: Record<string, string>;
  product_name?: string | null;
  actor?: unknown;
};

function formatSpecValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(formatSpecValue).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Keeps the specs JSON exactly as typed: same keys, same order, values as text.
// No keys are renamed or merged.
function normalizeSpecsRecord(specs: unknown) {
  let source = specs;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) return {} as Record<string, string>;

  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>).map(([key, value]) => [key, formatSpecValue(value)]),
  ) as Record<string, string>;
}

type CatalogMetaInput = {
  brands: string[];
  subcategoriesByCategory: Record<string, string[]>;
};

type ProductImageStorageInput = {
  images: string[];
};

type BestDealProductSelectionInput = {
  slugs: string[];
};

type ProductFeaturedInput = {
  id: string;
  title: string;
  featured: boolean;
};

type ProductCategoryPriorityInput = {
  id: string;
  title: string;
  category_priority: boolean;
};

// Schema setup only needs to run once per server instance, not on every request.
let operationsTablesReady: Promise<void> | undefined;

function ensureOperationsTables() {
  if (!operationsTablesReady) {
    operationsTablesReady = createOperationsTables().catch((error) => {
      operationsTablesReady = undefined;
      throw error;
    });
  }
  return operationsTablesReady;
}

async function createOperationsTables() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await sql`create extension if not exists pgcrypto`;

  await sql`
    alter table products
    add column if not exists is_hidden boolean not null default false
  `;
  await sql`
    alter table products
    add column if not exists catalogue_id uuid
  `;
  await sql`
    alter table products
    add column if not exists product_origin text not null default 'website'
  `;
  await sql`
    alter table products
    add column if not exists category_priority boolean not null default false
  `;
  await sql`
    update products
    set product_origin = 'inventory'
    where product_origin <> 'inventory'
      and coalesce(description, '') like 'Inventory-only product created%'
  `;

  await sql`
    create table if not exists product_catalogue (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      item text not null,
      specs jsonb not null default '{}'::jsonb,
      product_name text not null unique,
      created_by_email text,
      created_by_name text,
      created_by_role text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists idx_products_slug on products (slug)`;
  await sql`create index if not exists idx_products_created_at on products (created_at desc)`;
  await sql`create index if not exists idx_products_featured_created_at on products (featured, created_at desc)`;
  await sql`create index if not exists idx_products_category_priority on products (category_id, category_priority, created_at desc)`;
  await sql`create index if not exists idx_products_category_created_at on products (category_id, created_at desc)`;
  await sql`create index if not exists idx_products_visible_created_at on products (is_hidden, created_at desc)`;
  await sql`create index if not exists idx_products_price on products (price)`;
  await sql`create index if not exists idx_products_catalogue_id on products (catalogue_id)`;
  await sql`create index if not exists idx_products_origin_created_at on products (product_origin, created_at desc)`;
  await sql`create index if not exists idx_product_catalogue_item on product_catalogue (item, created_at desc)`;
}

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.",
    );
  }

  return { cloudName, apiKey, apiSecret };
}

async function uploadImageToCloudinary(image: string, folder: string) {
  if (!image.startsWith("data:image/")) return image;

  const matches = image.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!matches?.[1]) {
    throw new Error("Unsupported image format.");
  }

  const { createHash } = await import("node:crypto");
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");

  const body = new URLSearchParams({
    file: image,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
    folder,
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${text || response.statusText}`);
  }

  const result = (await response.json()) as { secure_url?: string };
  if (!result.secure_url) {
    throw new Error("Cloudinary upload did not return an image URL.");
  }

  return result.secure_url;
}

async function persistProductImage(image: string) {
  return uploadImageToCloudinary(image, "shop-ict/products");
}

const listAdminCategoriesServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async () => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  const rows = await sql`
    select id, name, slug, icon, description, sort_order, created_at
    from categories
    order by sort_order asc, created_at asc
  `;

  return rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    icon: row.icon ?? null,
    description: row.description ?? null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
  }));
});

const listAdminProductsServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async () => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();
  const { parseSubcategories } = await import("./products");

  await ensureOperationsTables();

  const rows = await sql`
    select
      p.*,
      c.name as category_name
    from products p
    left join categories c on c.id = p.category_id
    where coalesce(p.product_origin, 'website') = 'website'
    order by p.created_at desc
  `;

  return rows.map((row: any) => ({
    id: String(row.id),
    catalogue_id: row.catalogue_id ? String(row.catalogue_id) : null,
    title: String(row.title),
    slug: String(row.slug),
    description: row.description ?? null,
    brand: row.brand ?? null,
    subcategory: row.subcategory ?? null,
    subcategories: parseSubcategories(row.subcategory ?? null),
    price: Number(row.price ?? 0),
    old_price: row.old_price == null ? null : Number(row.old_price),
    stock_status: String(row.stock_status ?? "in_stock"),
    category_id: row.category_id ?? null,
    images: Array.isArray(row.images) ? row.images.map(String) : [],
    specs: normalizeSpecsRecord(row.specs),
    featured: Boolean(row.featured),
    category_priority: Boolean(row.category_priority),
    hidden: Boolean(row.is_hidden),
    badge: row.badge ?? null,
    warranty: row.warranty ?? null,
    categories: row.category_name ? { name: String(row.category_name) } : null,
  }));
});

const listProductCatalogueServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async () => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureOperationsTables();
  await syncProductsIntoCatalogue(sql);

  const rows = await sql`
    select
      c.*,
      p.id as product_id,
      p.price as product_price,
      p.stock_status as product_stock_status
    from product_catalogue c
    left join products p on (p.catalogue_id = c.id or lower(p.title) = lower(c.product_name))
      and coalesce(p.product_origin, 'website') = 'website'
    order by c.created_at desc
  `;

  const unique = new Map<string, any>();
  rows.forEach((row: any) => {
    const id = String(row.id);
    if (unique.has(id)) return;
    unique.set(id, {
      id,
      title: String(row.title ?? ""),
      item: String(row.item ?? ""),
      specs: normalizeSpecsRecord(row.specs),
      product_name: String(row.product_name ?? ""),
      product_id: row.product_id ? String(row.product_id) : null,
      product_price: row.product_price == null ? null : Number(row.product_price),
      product_stock_status: row.product_stock_status ? String(row.product_stock_status) : null,
      created_by_name: row.created_by_name ?? null,
      created_at: String(row.created_at),
    });
  });

  return Array.from(unique.values());
});

async function syncProductsIntoCatalogue(sql: any) {
  const productRows = await sql`
    select
      p.id,
      p.title,
      p.brand,
      p.subcategory,
      p.specs,
      p.catalogue_id,
      p.created_at,
      c.id as existing_catalogue_id
    from products p
    left join product_catalogue c on c.id = p.catalogue_id
    where coalesce(p.is_hidden, false) = false
      and coalesce(p.product_origin, 'website') = 'website'
    order by p.created_at desc
  `;

  for (const row of productRows) {
    if (row.catalogue_id && row.existing_catalogue_id) continue;

    const productName = String(row.title ?? "").trim();
    if (!productName) continue;

    const catalogueTitle = String(row.brand ?? "").trim() || productName;
    const item = String(row.subcategory ?? "").split(",")[0]?.trim() || "Product";
    const specs = normalizeSpecsRecord(row.specs);

    const insertedRows = await sql`
      insert into product_catalogue (title, item, specs, product_name)
      values (
        ${catalogueTitle},
        ${item},
        ${JSON.stringify(specs)}::jsonb,
        ${productName}
      )
      on conflict (product_name) do update
      set
        title = coalesce(nullif(product_catalogue.title, ''), excluded.title),
        item = coalesce(nullif(product_catalogue.item, ''), excluded.item),
        specs = case
          when product_catalogue.specs = '{}'::jsonb then excluded.specs
          else product_catalogue.specs
        end,
        updated_at = now()
      returning id
    `;

    const catalogueId = insertedRows[0]?.id ? String(insertedRows[0].id) : null;
    if (catalogueId) {
      await sql`update products set catalogue_id = ${catalogueId} where id = ${String(row.id)}`;
    }
  }
}

const createProductCatalogueBatchServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data, context }) => {
  const input = data as ProductCatalogueBatchInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureOperationsTables();

  const title = String(input.title ?? "").trim();
  const item = String(input.item ?? "").trim();
  const variants = (input.variants ?? [])
    .map((variant) => ({ specs: normalizeSpecsRecord(variant.specs) }))
    .filter((variant) => Object.keys(variant.specs).length > 0);

  if (!title) throw new Error("Title is required.");
  if (!item) throw new Error("Item is required.");
  if (variants.length === 0) throw new Error("Add at least one spec variant.");

  const created: string[] = [];

  for (const variant of variants) {
    const productName = buildCatalogueProductName(title, variant.specs);
    await sql`
      insert into product_catalogue (
        title, item, specs, product_name,
        created_by_email, created_by_name, created_by_role
      )
      values (
        ${title},
        ${item},
        ${JSON.stringify(variant.specs)}::jsonb,
        ${productName},
        ${context.admin.email},
        ${context.admin.name},
        ${context.admin.role}
      )
      on conflict (product_name) do update
      set
        title = excluded.title,
        item = excluded.item,
        specs = excluded.specs,
        updated_at = now()
    `;
    created.push(productName);
  }

  return { ok: true, count: created.length };
});

const updateProductCatalogueItemServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as ProductCatalogueUpdateInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureOperationsTables();

  const title = String(input.title ?? "").trim();
  const item = String(input.item ?? "").trim();
  const specs = normalizeSpecsRecord(input.specs);
  const productName = String(input.product_name ?? "").trim() || buildCatalogueProductName(title, specs);

  if (!input.id) throw new Error("Catalogue item is required.");
  if (!title) throw new Error("Title is required.");
  if (!item) throw new Error("Item is required.");
  if (Object.keys(specs).length === 0) throw new Error("Specs are required.");
  if (!productName) throw new Error("Product name is required.");

  await sql`
    update product_catalogue
    set
      title = ${title},
      item = ${item},
      specs = ${JSON.stringify(specs)}::jsonb,
      product_name = ${productName},
      updated_at = now()
    where id = ${input.id}
  `;

  await sql`
    update products
    set
      title = ${productName},
      brand = ${title},
      subcategory = ${item},
      specs = ${JSON.stringify(specs)}::jsonb,
      updated_at = now()
    where catalogue_id = ${input.id}
  `;

  return { ok: true };
});

const deleteProductCatalogueItemServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as { id: string };
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureOperationsTables();

  const [existing] = await sql`select product_name from product_catalogue where id = ${input.id} limit 1`;
  if (!existing) throw new Error("Catalogue item not found.");

  await sql`update products set catalogue_id = null where catalogue_id = ${input.id}`;
  await sql`delete from product_catalogue where id = ${input.id}`;
  return { ok: true };
});

const upsertAdminProductServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as ProductInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();
  const normalizedSpecs = normalizeSpecsRecord(input.specs ?? {});

  await ensureOperationsTables();

  if (input.id) {
    await sql`
      update products
      set
        title = ${input.title},
        catalogue_id = ${input.catalogue_id ?? null},
        slug = ${input.slug},
        description = ${input.description ?? null},
        brand = ${input.brand ?? null},
        subcategory = ${input.subcategory ?? null},
        product_origin = 'website',
        price = ${input.price},
        old_price = ${input.old_price ?? null},
        stock_status = ${input.stock_status},
        category_id = ${input.category_id ?? null},
        images = ${input.images}::text[],
        specs = ${JSON.stringify(normalizedSpecs)}::jsonb,
        featured = ${input.featured},
        is_hidden = ${Boolean(input.hidden)},
        badge = ${input.badge ?? null},
        warranty = ${input.warranty ?? null},
        updated_at = now()
      where id = ${input.id}
    `;
    return { ok: true };
  }

  await sql`
    insert into products (
      title, slug, description, price, old_price, stock_status,
      category_id, images, specs, featured, is_hidden, badge, warranty, brand, subcategory, catalogue_id, product_origin
    )
    values (
      ${input.title},
      ${input.slug},
      ${input.description ?? null},
      ${input.price},
      ${input.old_price ?? null},
      ${input.stock_status},
      ${input.category_id ?? null},
      ${input.images}::text[],
      ${JSON.stringify(normalizedSpecs)}::jsonb,
      ${input.featured},
      ${Boolean(input.hidden)},
      ${input.badge ?? null},
      ${input.warranty ?? null},
      ${input.brand ?? null},
      ${input.subcategory ?? null},
      ${input.catalogue_id ?? null},
      ${"website"}
    )
  `;
  return { ok: true };
});

const storeAdminProductImagesServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as ProductImageStorageInput;
  const normalizedImages = Array.isArray(input.images) ? input.images.map(String).filter(Boolean) : [];

  const storedImages = [];
  for (const image of normalizedImages) {
    storedImages.push(await persistProductImage(image));
  }

  return storedImages;
});

const deleteAdminProductServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as { id: string };
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await sql`delete from products where id = ${input.id}`;
  return { ok: true };
});

const fetchAdminCatalogMetaServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async () => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  const rows = await sql`
    select key, value
    from settings
    where key in ('brand_names', 'subcategory_map')
  `;

  const brandRow = rows.find((row: any) => row.key === "brand_names");
  const subcategoryRow = rows.find((row: any) => row.key === "subcategory_map");

  const brands = Array.isArray(brandRow?.value)
    ? brandRow.value.map((value: any) => String(value)).filter(Boolean)
    : [];

  const subcategoriesByCategory =
    subcategoryRow?.value && typeof subcategoryRow.value === "object" && !Array.isArray(subcategoryRow.value)
      ? Object.fromEntries(
          Object.entries(subcategoryRow.value).map(([key, value]) => [
            String(key),
            Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [],
          ]),
        )
      : {};

  return { brands, subcategoriesByCategory };
});

const fetchAdminBestDealProductSlugsServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async () => {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  const rows = await sql`
    select value
    from settings
    where key = 'homepage_best_deal_product_slugs'
    limit 1
  `;

  const value = rows[0]?.value;
  return Array.isArray(value) ? value.map((item: any) => String(item).trim()).filter(Boolean) : [];
});

const saveAdminBestDealProductSlugsServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as BestDealProductSelectionInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  const normalizedSlugs = Array.from(
    new Set((Array.isArray(input.slugs) ? input.slugs : []).map((slug) => String(slug).trim()).filter(Boolean)),
  );

  await sql`
    insert into settings (key, value, updated_at)
    values ('homepage_best_deal_product_slugs', ${JSON.stringify(normalizedSlugs)}::jsonb, now())
    on conflict (key)
    do update set value = excluded.value, updated_at = now()
  `;

  return { ok: true };
});

const updateAdminProductFeaturedServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as ProductFeaturedInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await sql`
    update products
    set featured = ${Boolean(input.featured)}, updated_at = now()
    where id = ${input.id}
  `;

  return { ok: true };
});

const updateAdminProductCategoryPriorityServer = createServerFn({ method: "POST" }).middleware([adminOnly]).handler(async ({ data }) => {
  const input = data as ProductCategoryPriorityInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureOperationsTables();

  await sql`
    update products
    set category_priority = ${Boolean(input.category_priority)}, updated_at = now()
    where id = ${input.id}
  `;

  return { ok: true };
});

function buildCatalogueProductName(title: string, specs: Record<string, string>) {
  const specValues = Object.values(specs)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return [String(title ?? "").trim(), ...specValues].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

export async function listAdminCategories() {
  return listAdminCategoriesServer();
}

export async function listAdminProducts() {
  return listAdminProductsServer();
}

export async function listProductCatalogue() {
  return listProductCatalogueServer() as Promise<
    Array<{
      id: string;
      title: string;
      item: string;
      specs: Record<string, string>;
      product_name: string;
      product_id: string | null;
      product_price: number | null;
      product_stock_status: string | null;
      created_by_name: string | null;
      created_at: string;
    }>
  >;
}

export async function createProductCatalogueBatch(input: ProductCatalogueBatchInput) {
  return createProductCatalogueBatchServer({ data: input }) as Promise<{ ok: true; count: number }>;
}

export async function updateProductCatalogueItem(input: ProductCatalogueUpdateInput) {
  return updateProductCatalogueItemServer({ data: input }) as Promise<{ ok: true }>;
}

export async function deleteProductCatalogueItem(id: string) {
  return deleteProductCatalogueItemServer({ data: { id } });
}

export async function upsertAdminProduct(input: ProductInput) {
  return upsertAdminProductServer({ data: input });
}

export async function storeAdminProductImages(images: string[]) {
  return storeAdminProductImagesServer({ data: { images } }) as Promise<string[]>;
}

export async function deleteAdminProduct(id: string) {
  return deleteAdminProductServer({ data: { id } });
}

export async function updateAdminProductCategoryPriority(input: ProductCategoryPriorityInput) {
  return updateAdminProductCategoryPriorityServer({ data: input }) as Promise<{ ok: true }>;
}

export async function fetchAdminBestDealProductSlugs() {
  return fetchAdminBestDealProductSlugsServer() as Promise<string[]>;
}

export async function saveAdminBestDealProductSlugs(slugs: string[]) {
  return saveAdminBestDealProductSlugsServer({ data: { slugs } });
}

export async function updateAdminProductFeatured(input: ProductFeaturedInput) {
  return updateAdminProductFeaturedServer({ data: input });
}

export async function fetchAdminCatalogMeta() {
  return fetchAdminCatalogMetaServer() as Promise<CatalogMetaInput>;
}
