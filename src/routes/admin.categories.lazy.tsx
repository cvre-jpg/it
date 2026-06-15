import { createLazyFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CATEGORY_TREE } from "@/lib/category-tree";
import { toast } from "sonner";
import {
  deleteAdminCategory,
  fetchAdminCatalogMeta,
  listAdminCategories,
  listAdminProducts,
  saveAdminCatalogMeta,
  upsertAdminCategory,
} from "@/lib/admin-data";

export const Route = createLazyFileRoute("/admin/categories")({ component: AdminCategories });
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const DEFAULT_BRANDS = ["HP", "Lenovo", "Dell", "Apple", "ASUS", "Acer", "Samsung", "LG", "Epson", "Canon", "JBL", "Logitech", "Anker", "UGREEN", "Kyocera"];

function getProductBrand(product: any) {
  const explicitBrand = String(product.brand ?? "").trim();
  if (explicitBrand) return explicitBrand;

  const title = String(product.title ?? "").trim();
  if (!title) return "";

  return title.split(/\s+/)[0] ?? "";
}

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const activeTab =
    path === "/admin/categories/brands"
      ? "brands"
      : path === "/admin/categories/sub-category"
        ? "subcategories"
        : "categories";
  const showTabs = path === "/admin/categories";
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", icon: "", sort_order: "0" });

  const [brandDraft, setBrandDraft] = useState("");
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [subcategoryCategory, setSubcategoryCategory] = useState(CATEGORY_TREE[0]?.label ?? "");
  const [subcategoryDraft, setSubcategoryDraft] = useState("");
  const [editingSubcategory, setEditingSubcategory] = useState<string | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["admin-cats-list"],
    queryFn: () => listAdminCategories(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-lite"],
    queryFn: () => listAdminProducts(),
  });
  const { data: catalogMeta } = useQuery({
    queryKey: ["admin-catalog-meta"],
    queryFn: () => fetchAdminCatalogMeta(),
  });

  const [brandNames, setBrandNames] = useState<string[]>([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!catalogMeta) return;
    setBrandNames(catalogMeta.brands);
    setSubcategoriesByCategory(catalogMeta.subcategoriesByCategory);
  }, [catalogMeta]);

  const categorySummaries = useMemo(
    () =>
      cats.map((c: any) => {
        const fallbackGroup = CATEGORY_TREE.find((item) => item.label === c.name);
        const brands = Array.from(
          new Set(
            products
              .filter((product: any) => product.categories?.name === c.name)
              .map((product: any) => getProductBrand(product))
              .filter(Boolean)
              .map((brand: any) => String(brand).trim()),
          ),
        ).sort((a, b) => a.localeCompare(b));

        return {
          ...c,
          subcategories:
            subcategoriesByCategory[c.name] && subcategoriesByCategory[c.name].length > 0
              ? subcategoriesByCategory[c.name]
              : fallbackGroup?.items ?? [],
          brands,
        };
      }),
    [cats, products, subcategoriesByCategory],
  );

  const mergedBrandNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_BRANDS,
          ...brandNames,
          ...products.map((product: any) => getProductBrand(product)).filter(Boolean).map((brand: any) => String(brand).trim()),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [brandNames, products],
  );

  const fallbackSubcategoryGroup = CATEGORY_TREE.find((item) => item.label === subcategoryCategory);
  const activeSubcategories =
    subcategoriesByCategory[subcategoryCategory] && subcategoriesByCategory[subcategoryCategory].length > 0
      ? subcategoriesByCategory[subcategoryCategory]
      : [...(fallbackSubcategoryGroup?.items ?? [])];

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm({ name: "", slug: "", icon: "", sort_order: "0" });
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return toast.error("Category name required");

    await upsertAdminCategory({
      id: editingCategoryId ?? undefined,
      name: categoryForm.name.trim(),
      slug: (categoryForm.slug || slugify(categoryForm.name)).trim(),
      icon: categoryForm.icon.trim() || null,
      sort_order: Number(categoryForm.sort_order || 0),
    });

    toast.success(editingCategoryId ? "Category updated" : "Category added");
    resetCategoryForm();
    qc.invalidateQueries({ queryKey: ["admin-cats-list"] });
  };

  const startEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name ?? "",
      slug: category.slug ?? "",
      icon: category.icon ?? "",
      sort_order: String(category.sort_order ?? 0),
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await deleteAdminCategory(id);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-cats-list"] });
  };

  const persistCatalogMeta = async (
    nextBrands: string[] = brandNames,
    nextSubcategories: Record<string, string[]> = subcategoriesByCategory,
  ) => {
    await saveAdminCatalogMeta({
      brands: nextBrands,
      subcategoriesByCategory: nextSubcategories,
    });
    qc.invalidateQueries({ queryKey: ["admin-catalog-meta"] });
  };

  const saveBrand = async () => {
    const value = brandDraft.trim();
    if (!value) return toast.error("Brand name required");

    const nextBrands = editingBrand
      ? brandNames.map((brand) => (brand === editingBrand ? value : brand))
      : Array.from(new Set([...brandNames, value]));

    setBrandNames(nextBrands);
    await persistCatalogMeta(nextBrands, subcategoriesByCategory);
    setBrandDraft("");
    setEditingBrand(null);
    toast.success(editingBrand ? "Brand updated" : "Brand added");
  };

  const startEditBrand = (brand: string) => {
    setEditingBrand(brand);
    setBrandDraft(brand);
  };

  const deleteBrand = async (brand: string) => {
    const nextBrands = brandNames.filter((item) => item !== brand);
    setBrandNames(nextBrands);
    await persistCatalogMeta(nextBrands, subcategoriesByCategory);
    if (editingBrand === brand) {
      setEditingBrand(null);
      setBrandDraft("");
    }
    toast.success("Brand removed");
  };

  const saveSubcategory = async () => {
    const value = subcategoryDraft.trim();
    if (!value) return toast.error("Subcategory name required");

    const nextItems = editingSubcategory
      ? activeSubcategories.map((item) => (item === editingSubcategory ? value : item))
      : Array.from(new Set([...activeSubcategories, value]));

    const nextSubcategories = {
      ...subcategoriesByCategory,
      [subcategoryCategory]: nextItems,
    };

    setSubcategoriesByCategory(nextSubcategories);
    await persistCatalogMeta(brandNames, nextSubcategories);
    setSubcategoryDraft("");
    setEditingSubcategory(null);
    toast.success(editingSubcategory ? "Subcategory updated" : "Subcategory added");
  };

  const startEditSubcategory = (item: string) => {
    setEditingSubcategory(item);
    setSubcategoryDraft(item);
  };

  const deleteSubcategory = async (item: string) => {
    const nextSubcategories = {
      ...subcategoriesByCategory,
      [subcategoryCategory]: activeSubcategories.filter((entry) => entry !== item),
    };

    setSubcategoriesByCategory(nextSubcategories);
    await persistCatalogMeta(brandNames, nextSubcategories);
    if (editingSubcategory === item) {
      setEditingSubcategory(null);
      setSubcategoryDraft("");
    }
    toast.success("Subcategory removed");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
      <div className="rounded-2xl border bg-card shadow-soft">
        <Tabs value={activeTab} className="p-4">
          {showTabs ? (
            <TabsList className="mb-4">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="subcategories">Subcategories</TabsTrigger>
              <TabsTrigger value="brands">Brands</TabsTrigger>
            </TabsList>
          ) : null}

          <TabsContent value="categories" className="mt-0 overflow-hidden rounded-2xl border">
            <div className="border-b bg-background p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_120px_auto]">
                <input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Category name"
                  className={inputCls}
                />
                <input
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  placeholder="Slug (auto)"
                  className={inputCls}
                />
                <input
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  placeholder="Icon"
                  className={inputCls}
                />
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })}
                  placeholder="Order"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <Button onClick={saveCategory} className="rounded-full px-5">
                    <Plus className="h-4 w-4" /> {editingCategoryId ? "Update" : "Add"}
                  </Button>
                  {editingCategoryId ? (
                    <Button variant="outline" onClick={resetCategoryForm} className="rounded-full">
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3">Name</th><th>Slug</th><th>Order</th><th></th></tr>
              </thead>
              <tbody>
                {categorySummaries.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.icon || "-"}</div>
                    </td>
                    <td className="text-muted-foreground">{c.slug}</td>
                    <td className="text-muted-foreground">{c.sort_order ?? 0}</td>
                    <td className="px-4">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEditCategory(c)} className="rounded-lg p-2 hover:bg-surface"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(c.id)} className="rounded-lg p-2 hover:bg-surface"><Trash2 className="h-4 w-4 text-primary" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="subcategories" className="mt-0 space-y-4">
            <div className="rounded-2xl border bg-background p-4">
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                <select
                  value={subcategoryCategory}
                  onChange={(e) => {
                    setSubcategoryCategory(e.target.value);
                    setEditingSubcategory(null);
                    setSubcategoryDraft("");
                  }}
                  className={inputCls}
                >
                  {cats.map((category: any) => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
                <input
                  value={subcategoryDraft}
                  onChange={(e) => setSubcategoryDraft(e.target.value)}
                  placeholder="Add or rename subcategory"
                  className={inputCls}
                />
                <Button onClick={saveSubcategory} className="rounded-full px-5">
                  <Plus className="h-4 w-4" /> {editingSubcategory ? "Update" : "Add"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-background">
              {activeSubcategories.length > 0 ? (
                activeSubcategories.map((item) => (
                  <div key={item} className="flex items-center justify-between border-t px-4 py-3 first:border-t-0">
                    <span className="text-sm text-foreground">{item}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEditSubcategory(item)} className="rounded-lg p-2 hover:bg-surface"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => deleteSubcategory(item)} className="rounded-lg p-2 hover:bg-surface"><Trash2 className="h-4 w-4 text-primary" /></button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-muted-foreground">No subcategories added for {subcategoryCategory} yet.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="brands" className="mt-0 space-y-4">
            <div className="rounded-2xl border bg-background p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={brandDraft}
                  onChange={(e) => setBrandDraft(e.target.value)}
                  placeholder="Add or rename brand"
                  className={inputCls}
                />
                <Button onClick={saveBrand} className="rounded-full px-5">
                  <Plus className="h-4 w-4" /> {editingBrand ? "Update" : "Add"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-background">
              {mergedBrandNames.length > 0 ? (
                mergedBrandNames.map((brand) => (
                  <div key={brand} className="flex items-center justify-between border-t px-4 py-3 first:border-t-0">
                    <span className="text-sm text-foreground">{brand}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEditBrand(brand)} className="rounded-lg p-2 hover:bg-surface"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => deleteBrand(brand)} className="rounded-lg p-2 hover:bg-surface"><Trash2 className="h-4 w-4 text-primary" /></button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-muted-foreground">No brand names added yet.</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AdminCategories() {
  return <AdminCategoriesPage />;
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
