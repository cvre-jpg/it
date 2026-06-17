import { createLazyFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Plus, Pencil, Trash2, Sparkles, Star, X, Search, ArrowUp } from "lucide-react";
import { formatKES } from "@/lib/format";
import { CATEGORY_TREE } from "@/lib/category-tree";
import { prepareUploadedImage } from "@/lib/images";
import { stringifySubcategories } from "@/lib/products";
import { toast } from "sonner";
import {
  deleteAdminProduct,
  fetchAdminBestDealProductSlugs,
  fetchAdminCatalogMeta,
  listProductCatalogue,
  listAdminCategories,
  listAdminProducts,
  saveAdminBestDealProductSlugs,
  storeAdminProductImages,
  updateAdminProductCategoryPriority,
  updateAdminProductFeatured,
  upsertAdminProduct,
} from "@/lib/admin-data";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createLazyFileRoute("/admin/products")({ component: AdminProducts });

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Form = {
  id?: string;
  catalogue_id: string;
  title: string; description: string;
  brand: string; subcategory: string; specs: string;
  price: string; stock_status: string;
  category_id: string; images: string[]; colors: string[]; featured: boolean; hidden: boolean; badge_type: string; badge_value: string;
};

const DEFAULT_SPECS_TEMPLATE = `{
  "Model Number": "Hp Victus -16 inch core i5 13th gen 16gb ram / 512 ssd Rtx 3050 6gb",
  "Features": "Ex-UK Laptops",
  "Colour": "Not specified",
  "Condition": "Refurbished",
  "Size": "6gb",
  "Operating system": "Windows 11",
  "Processor": "Core i5",
  "RAM (GB)": "16",
  "Screen size (in)": "16"
}`;

function createEmptyForm(): Form {
  return {
    title: "",
    catalogue_id: "",
    description: "",
    brand: "",
    subcategory: "",
    specs: DEFAULT_SPECS_TEMPLATE,
    price: "",
    stock_status: "in_stock",
    category_id: "",
    images: [],
    colors: [],
    featured: false,
    hidden: false,
    badge_type: "none",
    badge_value: "",
  };
}

const empty = createEmptyForm();
const DEFAULT_BRANDS = [
  "HP",
  "Lenovo",
  "Dell",
  "Apple",
  "ASUS",
  "Acer",
  "Samsung",
  "LG",
  "Epson",
  "Canon",
  "JBL",
  "Logitech",
  "Anker",
  "UGREEN",
  "Kyocera",
];
const COLOR_OPTIONS = ["Black", "White", "Grey"] as const;

function invalidateStorefrontProductQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return (
        key === "featured" ||
        key === "cat-laptops" ||
        key === "cat-phones" ||
        key === "cat-monitors" ||
        key === "cat-printers" ||
        key === "shop-products" ||
        key === "product" ||
        key === "related-products"
      );
    },
  });
}

export function AdminProductsPage() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const showFormOnly = path === "/admin/products/add";
  const showListOnly = path === "/admin/products/list";
  const showForm = !showListOnly;
  const showList = !showFormOnly;
  const pageSize = 20;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(createEmptyForm());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [savingBestDealSlug, setSavingBestDealSlug] = useState<string | null>(null);
  const [savingFeaturedProductId, setSavingFeaturedProductId] = useState<string | null>(null);
  const [savingPriorityProductId, setSavingPriorityProductId] = useState<string | null>(null);

  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
    error: productsErrorDetails,
  } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listAdminProducts(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-cats"],
    queryFn: () => listAdminCategories(),
  });
  const { data: bestDealSlugs = [] } = useQuery({
    queryKey: ["admin-best-deal-product-slugs"],
    queryFn: () => fetchAdminBestDealProductSlugs(),
  });
  const { data: catalogMeta } = useQuery({
    queryKey: ["admin-catalog-meta"],
    queryFn: () => fetchAdminCatalogMeta(),
  });
  const { data: catalogue = [] } = useQuery({
    queryKey: ["product-catalogue"],
    queryFn: () => listProductCatalogue(),
  });
  const bestDealSlugSet = new Set(bestDealSlugs);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter((p: any) => {
    const matchesSearch =
      !normalizedSearch ||
      [p.title, p.slug, p.brand, p.subcategory, p.categories?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));

    const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter;
    const matchesFeatured =
      featuredFilter === "all" ||
      (featuredFilter === "featured" && bestDealSlugSet.has(p.slug)) ||
      (featuredFilter === "regular" && !bestDealSlugSet.has(p.slug));

    return matchesSearch && matchesCategory && matchesFeatured;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedCategoryName = categories.find((category: any) => category.id === form.category_id)?.name ?? "";
  const selectedCategoryGroup = CATEGORY_TREE.find((category) => category.label === selectedCategoryName);
  const suggestedSubcategories =
    (selectedCategoryName && catalogMeta?.subcategoriesByCategory?.[selectedCategoryName]?.length
      ? catalogMeta.subcategoriesByCategory[selectedCategoryName]
      : selectedCategoryGroup?.items) ?? [];
  const brandOptions = Array.from(
    new Set(
      [...DEFAULT_BRANDS, ...(catalogMeta?.brands ?? []), ...products.map((product: any) => product.brand).filter(Boolean)]
        .map((brand) => String(brand).trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const selectedSubcategoryValues = form.subcategory
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const startEdit = (p: any) => {
    let badge_type = "none";
    let badge_value = "";
    if (p.badge === "New") badge_type = "new";
    else if (p.badge === "Hot") badge_type = "hot";
    else if (p.badge && p.badge.includes("%")) {
      badge_type = "custom";
      const match = p.badge.match(/(\d+)%/);
      badge_value = match ? match[1] : "";
    }
    setForm({
      id: p.id, title: p.title, description: p.description || "", brand: p.brand || "", subcategory: (p.subcategories || []).join(", ") || p.subcategory || "", specs: JSON.stringify(p.specs || {}, null, 2),
      catalogue_id: p.catalogue_id || "",
      price: String(p.price),
      stock_status: p.stock_status, category_id: p.category_id || "",
      images: Array.isArray(p.images) ? p.images.map(String) : [],
      colors: String(p.specs?.["Available colours"] || p.specs?.["Available colors"] || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => COLOR_OPTIONS.includes(value as (typeof COLOR_OPTIONS)[number])),
      featured: p.featured, hidden: Boolean(p.hidden), badge_type, badge_value,
    });
    setOpen(true);
  };
  const startCreate = () => {
    setForm(createEmptyForm());
    setOpen(true);
  };

  const save = async (draft = form) => {
    const isEditing = Boolean(draft.id);
    const requiredTextFields = [
      { label: "Product", value: draft.title },
      { label: "Brand", value: draft.brand },
      { label: "Subcategory", value: draft.subcategory },
      { label: "Specs JSON", value: draft.specs },
      { label: "Price", value: draft.price },
      { label: "Description", value: draft.description },
    ];

    const missingField = requiredTextFields.find(({ value }) => !value.trim());
    if (missingField) {
      toast.error(`${missingField.label} is required`);
      return;
    }
    if (!isEditing && !draft.catalogue_id) {
      toast.error("Select a product from the catalogue dropdown");
      return;
    }
    if (!draft.category_id) {
      toast.error("Category is required");
      return;
    }
    if (draft.images.length === 0) {
      toast.error("At least one image is required");
      return;
    }

    let parsedSpecs: Record<string, string> = {};
    try {
      parsedSpecs = draft.specs.trim() ? JSON.parse(draft.specs) : {};
    } catch {
      toast.error("Specs must be valid JSON");
      return;
    }

    const parsedSubcategories = Array.from(
      new Set(
        draft.subcategory
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    let badge = null;
    if (draft.badge_type === "new") badge = "New";
    else if (draft.badge_type === "hot") badge = "Hot";
    else if (draft.badge_type === "custom" && draft.badge_value) badge = `${draft.badge_value}% off`;

    let oldPrice = null;
    if (draft.badge_type === "custom" && draft.badge_value && draft.price) {
      const percent = Number(draft.badge_value);
      const price = Number(draft.price);
      if (!isNaN(percent) && !isNaN(price) && percent > 0) {
        oldPrice = Math.round(price / (1 - percent / 100));
      }
    }

    if (draft.colors.length > 0) {
      parsedSpecs["Available colours"] = draft.colors.join(", ");
    } else {
      delete parsedSpecs["Available colours"];
      delete parsedSpecs["Available colors"];
    }

    try {
      const storedImages = await storeAdminProductImages(draft.images);

      await upsertAdminProduct({
        id: draft.id,
        catalogue_id: draft.catalogue_id || null,
        title: draft.title,
        slug: slugify(draft.title),
        description: draft.description || null,
        brand: draft.brand || null,
        subcategory: stringifySubcategories(parsedSubcategories),
        price: Number(draft.price),
        old_price: oldPrice,
        stock_status: draft.stock_status,
        category_id: draft.category_id || null,
        images: storedImages,
        specs: parsedSpecs,
        featured: draft.featured,
        hidden: draft.hidden,
        badge: badge,
      });

      toast.success(isEditing ? "Product updated" : "Product created");
      setForm(createEmptyForm());
      if (!showFormOnly) {
        setOpen(false);
      }
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      invalidateStorefrontProductQueries(qc);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save product";
      toast.error(message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await deleteAdminProduct(id);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    invalidateStorefrontProductQueries(qc);
  };

  const toggleBestDealProduct = async (product: any) => {
    const slug = String(product.slug ?? "").trim();
    if (!slug) {
      toast.error("This product is missing a slug.");
      return;
    }

    const nextSlugs = bestDealSlugSet.has(slug)
      ? bestDealSlugs.filter((item) => item !== slug)
      : [...bestDealSlugs, slug];

    try {
      setSavingBestDealSlug(slug);
      await saveAdminBestDealProductSlugs(nextSlugs);
      toast.success(bestDealSlugSet.has(slug) ? "Removed from Best Deals" : "Added to Best Deals");
      qc.invalidateQueries({ queryKey: ["admin-best-deal-product-slugs"] });
      invalidateStorefrontProductQueries(qc);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update Best Deals.";
      toast.error(message);
    } finally {
      setSavingBestDealSlug(null);
    }
  };

  const toggleFeaturedProduct = async (product: any) => {
    const nextFeatured = !Boolean(product.featured);

    try {
      setSavingFeaturedProductId(product.id);
      await updateAdminProductFeatured({
        id: String(product.id),
        title: String(product.title),
        featured: nextFeatured,
      });
      toast.success(nextFeatured ? "Featured on homepage" : "Removed from homepage featured products");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      invalidateStorefrontProductQueries(qc);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update homepage feature.";
      toast.error(message);
    } finally {
      setSavingFeaturedProductId(null);
    }
  };

  const toggleCategoryPriority = async (product: any) => {
    const nextPriority = !Boolean(product.category_priority);

    try {
      setSavingPriorityProductId(product.id);
      await updateAdminProductCategoryPriority({
        id: String(product.id),
        title: String(product.title),
        category_priority: nextPriority,
      });
      toast.success(nextPriority ? "Product moved to top of category" : "Product removed from category top priority");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      invalidateStorefrontProductQueries(qc);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update category priority.";
      toast.error(message);
    } finally {
      setSavingPriorityProductId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{showFormOnly ? "Add New Product" : showListOnly ? "Products List" : "Products"}</h1>
        </div>
        {showList ? <Button onClick={startCreate} className="rounded-full"><Plus className="h-4 w-4" /> Add product</Button> : null}
      </header>

      {showList ? <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by product, slug, brand, or subcategory"
              className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }} className={inputCls}>
            <option value="all">All categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={featuredFilter} onChange={(e) => {
            setFeaturedFilter(e.target.value);
            setPage(1);
          }} className={inputCls}>
            <option value="all">All products</option>
            <option value="featured">Best Deals only</option>
            <option value="regular">Not in Best Deals</option>
          </select>
        </div>
      </div> : null}

      {showList && productsError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load products. {productsErrorDetails instanceof Error ? productsErrorDetails.message : "Please check the database connection and try again."}
        </div>
      ) : null}

      {showList ? <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3 sm:px-4">Product</th>
              <th className="w-28 px-1 py-3 sm:w-72 sm:px-2">
                <span className="sr-only sm:not-sr-only">Homepage placement</span>
              </th>
              <th className="w-16 px-1 py-3 sm:w-24 sm:px-2"></th>
            </tr>
          </thead>
          <tbody>
            {productsLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6">
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="grid grid-cols-[minmax(0,1.6fr)_0.9fr_80px] items-center gap-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        </div>
                        <Skeleton className="h-9 w-32 rounded-full" />
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <Skeleton className="h-8 w-8 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ) : null}
            {paginatedProducts.map((p: any) => {
              const isBestDeal = bestDealSlugSet.has(p.slug);
              const isSavingBestDeal = savingBestDealSlug === p.slug;
              const isSavingFeatured = savingFeaturedProductId === p.id;
              const isSavingPriority = savingPriorityProductId === p.id;

              return (
              <tr key={p.id} className="border-t">
                <td className="min-w-0 px-3 py-3 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="hidden h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white sm:block">{p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-contain object-center" />}</div>
                    <div className="min-w-0">
                      <div className="flex max-w-full items-center gap-1 font-medium">
                        <span className="truncate" title={p.title}>{p.title}</span>
                        {Boolean(p.featured) && <Sparkles className="h-3 w-3 shrink-0 fill-primary text-primary" />}
                        {isBestDeal && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                        {Boolean(p.category_priority) && <ArrowUp className="h-3 w-3 shrink-0 text-[#15803D]" />}
                        {p.hidden ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Hidden</span> : null}
                      </div>
                      <div className="hidden max-w-full truncate text-xs text-muted-foreground sm:block" title={`/${p.slug}`}>/{p.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-1 sm:px-2">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                      type="button"
                      variant={Boolean(p.featured) ? "default" : "outline"}
                      size="icon"
                      className="hidden h-7 w-7 rounded-full sm:inline-flex sm:h-9 sm:w-auto sm:px-3"
                      disabled={isSavingFeatured}
                      onClick={() => toggleFeaturedProduct(p)}
                      aria-label={p.featured ? "Remove from homepage featured products" : "Feature on homepage"}
                      title={p.featured ? "Remove from homepage featured products" : "Feature on homepage"}
                    >
                      <Sparkles className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${p.featured ? "fill-current" : ""}`} />
                      <span className="hidden sm:inline">{p.featured ? "Featured" : "Feature"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant={isBestDeal ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7 rounded-full sm:h-9 sm:w-9"
                      disabled={isSavingBestDeal}
                      onClick={() => toggleBestDealProduct(p)}
                      aria-label={isBestDeal ? "Remove from Best Deals" : "Add to Best Deals"}
                      title={isBestDeal ? "Remove from Best Deals" : "Add to Best Deals"}
                    >
                      <Star className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isBestDeal ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      type="button"
                      variant={Boolean(p.category_priority) ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7 rounded-full sm:h-9 sm:w-auto sm:px-3"
                      disabled={isSavingPriority}
                      onClick={() => toggleCategoryPriority(p)}
                      aria-label={p.category_priority ? "Remove from category top priority" : "Show first in category"}
                      title={p.category_priority ? "Remove from category top priority" : "Show first in category"}
                    >
                      <ArrowUp className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${p.category_priority ? "stroke-[3]" : ""}`} />
                      <span className="hidden sm:inline">{p.category_priority ? "Top" : "Make top"}</span>
                    </Button>
                  </div>
                </td>
                <td className="px-1 sm:px-4">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEdit(p)} className="rounded-lg p-1 hover:bg-surface sm:p-2" aria-label="Edit product" title="Edit product"><Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                    <button onClick={() => remove(p.id)} className="rounded-lg p-1 hover:bg-surface sm:p-2" aria-label="Delete product" title="Delete product"><Trash2 className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" /></button>
                  </div>
                </td>
              </tr>
            )})}
            {!productsLoading && filteredProducts.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-muted-foreground">No products match your current search or filters.</td></tr>}
          </tbody>
        </table>
        </div>
      </div> : null}

      {showList && filteredProducts.length > pageSize && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 text-sm shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="min-w-20 text-center text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showFormOnly ? (
        <div className="rounded-3xl border bg-background p-6 shadow-elegant">
          <ProductEditor
            form={form}
            setForm={setForm}
            categories={categories}
            catalogue={catalogue}
            products={products}
            selectedSubcategoryValues={selectedSubcategoryValues}
            suggestedSubcategories={suggestedSubcategories}
            brandOptions={brandOptions}
            save={save}
            onEditProduct={startEdit}
          />
        </div>
      ) : null}

      {open && showList && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-3 md:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-background p-4 shadow-elegant md:p-5" onClick={(e) => e.stopPropagation()}>
            <ProductEditor
              form={form}
              setForm={setForm}
              categories={categories}
              catalogue={catalogue}
              products={products}
              selectedSubcategoryValues={selectedSubcategoryValues}
              suggestedSubcategories={suggestedSubcategories}
              brandOptions={brandOptions}
              save={save}
              onClose={() => setOpen(false)}
              onEditProduct={startEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AdminProducts() {
  return <AdminProductsPage />;
}

function ProductEditor({
  form,
  setForm,
  categories,
  catalogue,
  products,
  selectedSubcategoryValues,
  suggestedSubcategories,
  brandOptions,
  save,
  onClose,
  onEditProduct,
}: {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  categories: any[];
  products: any[];
  catalogue: Array<{
    id: string;
    title: string;
    item: string;
    specs: Record<string, string>;
    product_name: string;
    product_id?: string | null;
  }>;
  selectedSubcategoryValues: string[];
  suggestedSubcategories: string[];
  brandOptions: string[];
  save: (draft?: Form) => Promise<void>;
  onClose?: () => void;
  onEditProduct: (product: any) => void;
}) {
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const draggedImageIndexRef = useRef<number | null>(null);
  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextImages = await Promise.all(
      Array.from(files).map((file) =>
        prepareUploadedImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
          mimeType: "image/webp",
        }),
      ),
    );

    setForm({
      ...form,
      images: [...form.images, ...nextImages.filter(Boolean)],
    });
  };
  const normalizedBrandSearch = form.brand.trim().toLowerCase();
  const brandSuggestions =
    brandMenuOpen && normalizedBrandSearch.length > 0
      ? brandOptions.filter((brand) => brand.toLowerCase().includes(normalizedBrandSearch)).slice(0, 8)
      : [];
  const normalizedProductSearch = form.title.trim().toLowerCase();
  const productSuggestions =
    productMenuOpen && normalizedProductSearch.length > 0
      ? catalogue
          .filter((entry) =>
            [entry.product_name, entry.title, entry.item, ...Object.values(entry.specs ?? {})]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedProductSearch)),
          )
          .slice(0, 10)
      : [];
  const findListedProduct = (entry: { id: string; product_id?: string | null; product_name: string }) =>
    products.find((product: any) =>
      (entry.product_id && String(product.id) === String(entry.product_id)) ||
      String(product.catalogue_id ?? "") === String(entry.id) ||
      String(product.title ?? "").toLowerCase() === String(entry.product_name ?? "").toLowerCase(),
    );

  const setCoverImage = (index: number) => {
    if (index <= 0 || index >= form.images.length) return;
    const selectedImage = form.images[index];
    const remainingImages = form.images.filter((_, imageIndex) => imageIndex !== index);
    setForm({
      ...form,
      images: [selectedImage, ...remainingImages],
    });
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= form.images.length || toIndex >= form.images.length) return;
    setForm((current) => {
      const nextImages = [...current.images];
      const [selectedImage] = nextImages.splice(fromIndex, 1);
      nextImages.splice(toIndex, 0, selectedImage);
      return {
        ...current,
        images: nextImages,
      };
    });
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{form.id ? "Edit product" : "New product"}</h2>
        {onClose ? <button onClick={onClose} className="rounded-full p-2 hover:bg-surface"><X className="h-4 w-4" /></button> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Product *" className="sm:col-span-2 xl:col-span-3">
          <div className="relative">
            <input
              required
              value={form.title}
              onChange={(event) => {
                setForm({ ...form, catalogue_id: "", title: event.target.value });
                setProductMenuOpen(true);
              }}
              onFocus={() => setProductMenuOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setProductMenuOpen(false), 120);
              }}
              placeholder="Start typing and select a catalogue product"
              autoComplete="off"
              className={inputCls}
            />
            {productSuggestions.length > 0 ? (
              <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
                {productSuggestions.map((entry) => {
                  const listedProduct = findListedProduct(entry);
                  const isListed = Boolean(listedProduct);

                  return (
                    <div
                      key={entry.id}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-[#fff8f9]"
                    >
                      <button
                        type="button"
                        disabled={isListed}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (isListed) return;
                          setForm({
                            ...form,
                            catalogue_id: entry.id,
                            title: entry.product_name,
                            subcategory: entry.item,
                          });
                          setProductMenuOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">{entry.product_name}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isListed ? "bg-[#ECFDF3] text-[#15803D]" : "bg-[#FFF7ED] text-[#C2410C]"
                            }`}
                          >
                            {isListed ? "Listed" : "Unlisted"}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{entry.item}</span>
                      </button>
                      {isListed ? (
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setProductMenuOpen(false);
                            onEditProduct(listedProduct);
                          }}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-foreground transition hover:border-[#e92d48] hover:text-[#e92d48]"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[#e92d48] px-3 py-1.5 text-xs font-semibold text-white">List</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : productMenuOpen && normalizedProductSearch.length > 0 ? (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-lg">
                No catalogue product found.
              </div>
            ) : null}
          </div>
        </Field>
        <Field label="Brand / Company *">
          <div className="relative">
            <input
              required
              value={form.brand}
              onChange={(e) => {
                setForm({ ...form, brand: e.target.value });
                setBrandMenuOpen(true);
              }}
              onFocus={() => setBrandMenuOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setBrandMenuOpen(false), 120);
              }}
              placeholder="Type brand name"
              autoComplete="off"
              className={inputCls}
            />
            {brandSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                {brandSuggestions.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setForm((current) => ({ ...current, brand }));
                      setBrandMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-foreground transition hover:bg-[#fff8f9]"
                  >
                    {brand}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Field>
        <Field label="Category *">
          <Select value={form.category_id || "none"} onValueChange={(value) => setForm({ ...form, category_id: value === "none" ? "" : value })}>
            <SelectTrigger className="h-[42px] rounded-xl border-border bg-background px-3 text-foreground">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="focus:bg-[#fff1f4] focus:text-[#e92d48]">No category</SelectItem>
              {categories.map((c: any) => <SelectItem key={c.id} value={c.id} className="focus:bg-[#fff1f4] focus:text-[#e92d48] data-[state=checked]:bg-[#e92d48] data-[state=checked]:text-white">{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Subcategory *">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-[42px] w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-sm text-foreground transition">
                <span className="truncate text-left">{selectedSubcategoryValues.length > 0 ? selectedSubcategoryValues.join(", ") : "Select subcategories"}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Subcategories</p>
                  <p className="text-xs text-muted-foreground">You can select more than one.</p>
                </div>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {suggestedSubcategories.length > 0 ? suggestedSubcategories.map((item) => (
                    <label key={item} className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-[#fff8f9]">
                      <Checkbox checked={selectedSubcategoryValues.includes(item)} onCheckedChange={(checked) => {
                        const next = checked ? [...selectedSubcategoryValues, item] : selectedSubcategoryValues.filter((value) => value !== item);
                        setForm({ ...form, subcategory: Array.from(new Set(next)).join(", ") });
                      }} />
                      <span className="leading-5">{item}</span>
                    </label>
                  )) : <p className="text-sm text-muted-foreground">Choose a category first to load subcategories.</p>}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Price (KES) *"><input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} /></Field>
        <Field label="Stock *"><select value={form.stock_status} onChange={(e) => setForm({ ...form, stock_status: e.target.value })} className={inputCls}><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></select></Field>
        <Field label="Available colours">
          <div className="grid grid-cols-3 gap-2">
            {COLOR_OPTIONS.map((color) => {
              const checked = form.colors.includes(color);
              return (
                <label
                  key={color}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm transition ${
                    checked ? "border-[#e92d48] bg-[#fff1f4] text-[#e92d48]" : "border-border bg-background text-foreground hover:bg-[#fff8f9]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        colors: event.target.checked
                          ? [...current.colors, color]
                          : current.colors.filter((value) => value !== color),
                      }))
                    }
                    className="sr-only"
                  />
                  {color}
                </label>
              );
            })}
          </div>
        </Field>
        <Field label="Badge *">
          <Select value={form.badge_type} onValueChange={(value) => setForm({ ...form, badge_type: value })}>
            <SelectTrigger className="h-[42px] rounded-xl px-3"><SelectValue placeholder="Select badge" /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="new">New</SelectItem><SelectItem value="hot">Hot</SelectItem><SelectItem value="custom">Custom (% off)</SelectItem></SelectContent>
          </Select>
          {form.badge_type === "custom" ? <input type="number" placeholder="Enter % off" value={form.badge_value} onChange={(e) => setForm({ ...form, badge_value: e.target.value })} className={`${inputCls} mt-2`} /> : null}
        </Field>
        <Field label="Specs JSON *" className="sm:col-span-2 xl:col-span-1"><textarea required rows={5} value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} placeholder={DEFAULT_SPECS_TEMPLATE} className={`${inputCls} min-h-[132px]`} /></Field>
        <Field label="Description *" className="sm:col-span-2 xl:col-span-1"><textarea required rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} min-h-[132px]`} /></Field>
        <Field label="Images *" className="sm:col-span-2 xl:col-span-3">
          <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
            {form.images.length > 0 ? (
              <div className="relative space-y-2">
                <p className="text-xs text-muted-foreground">Drag images to reorder them. The first image is the cover.</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                  {form.images.map((image, index) => (
                        <div
                          key={`${index}-${image.slice(0, 24)}`}
                          draggable
                          onDragStart={(event) => {
                            draggedImageIndexRef.current = index;
                            setDraggedImageIndex(index);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", String(index));
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            const fromIndex = draggedImageIndexRef.current;
                            if (fromIndex == null || fromIndex === index) return;
                            moveImage(fromIndex, index);
                            draggedImageIndexRef.current = index;
                            setDraggedImageIndex(index);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            draggedImageIndexRef.current = null;
                            setDraggedImageIndex(null);
                          }}
                          onDragEnd={() => {
                            draggedImageIndexRef.current = null;
                            setDraggedImageIndex(null);
                          }}
                          className={`cursor-grab overflow-hidden rounded-2xl border bg-background active:cursor-grabbing ${
                            draggedImageIndex === index ? "border-[#e92d48] ring-2 ring-[#e92d48]/20" : ""
                          }`}
                        >
                          <div className="relative aspect-square w-full overflow-hidden bg-white">
                            <img
                              src={image}
                              alt={`Product upload ${index + 1}`}
                              draggable={false}
                              className="pointer-events-none h-full w-full select-none object-contain object-center"
                            />
                            {index === 0 ? (
                              <span className="absolute left-3 top-3 rounded-full bg-[#e92d48] px-2.5 py-1 text-[10px] font-semibold text-white">
                                Cover
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  images: form.images.filter((_, imageIndex) => imageIndex !== index),
                                })
                              }
                              className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white transition hover:bg-black"
                              aria-label={`Remove image ${index + 1}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 p-3">
                            <span className="truncate text-[11px] text-muted-foreground">Image {index + 1} of {form.images.length}</span>
                            {index === 0 ? (
                              <span className="text-[11px] font-medium text-[#e92d48]">Main image</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCoverImage(index)}
                                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-[#e92d48] hover:text-[#e92d48]"
                              >
                                Set as cover
                              </button>
                            )}
                          </div>
                        </div>
                  ))}
                  <label className="flex aspect-square min-w-0 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-2 text-center transition hover:bg-[#fff8f9]">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-semibold text-[#e92d48] shadow-sm">+</span>
                  <span className="mt-2 text-xs font-medium text-foreground">Add images</span>
                  <span className="mt-1 text-[11px] text-muted-foreground">Upload more</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      try {
                        await addImages(e.target.files);
                        e.target.value = "";
                      } catch {
                        toast.error("Could not load one or more images");
                      }
                    }}
                  />
                </label>
                </div>
              </div>
            ) : (
              <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-xl bg-surface px-4 py-5 text-center transition hover:bg-[#fff8f9]">
                <span className="text-sm font-medium text-foreground">Choose images from this device</span>
                <span className="mt-1 text-xs text-muted-foreground">Upload one or many images. The first image will be used as the cover.</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={async (e) => {
                    try {
                      await addImages(e.target.files);
                      e.target.value = "";
                    } catch {
                      toast.error("Could not load one or more images");
                    }
                  }}
                />
              </label>
            )}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-1 xl:self-end"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured on homepage</label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-1 xl:self-end"><input type="checkbox" checked={form.hidden} onChange={(e) => setForm({ ...form, hidden: e.target.checked })} /> Hide from store</label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onClose ? <Button variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button> : null}
        <Button className="rounded-full" onClick={() => save(form)}>{form.id ? "Save" : "Create"}</Button>
      </div>
    </>
  );
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>{children}</div>;
}
