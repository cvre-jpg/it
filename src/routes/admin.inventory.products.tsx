import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteInventoryProduct,
  listInventoryProducts,
  upsertInventoryProduct,
} from "@/lib/admin-data";

export const Route = createFileRoute("/admin/inventory/products")({
  component: AdminInventoryProductsPage,
});

type InventoryProductForm = {
  id?: string;
  title: string;
  stock_status: string;
};

const emptyForm: InventoryProductForm = {
  title: "",
  stock_status: "in_stock",
};

function AdminInventoryProductsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const [form, setForm] = useState<InventoryProductForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => listInventoryProducts(),
  });

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.title, product.stock_status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [products, search]);

  const save = async () => {
    if (!actor) return;
    if (!form.title.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      await upsertInventoryProduct({
        id: form.id,
        title: form.title,
        stock_status: form.stock_status,
        actor,
      });
      toast.success(form.id ? "Inventory product updated" : "Inventory product saved");
      setForm(emptyForm);
      setFormOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inventory-products"] }),
        qc.invalidateQueries({ queryKey: ["inventory-records"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save inventory product");
    }
  };

  const startEdit = (product: (typeof products)[number]) => {
    setForm({
      id: product.id,
      title: product.title,
      stock_status: product.stock_status || "in_stock",
    });
    setFormOpen(true);
  };

  const remove = async (product: (typeof products)[number]) => {
    if (!actor) return;
    if (!confirm(`Delete ${product.title}?`)) return;

    try {
      await deleteInventoryProduct(product.id, actor);
      toast.success("Inventory product deleted");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inventory-products"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete inventory product");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card shadow-soft">
        <div className="border-b p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Inventory product list</h2>
              <p className="text-sm text-muted-foreground">These names stay separate from the website catalogue.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs font-semibold text-[#4B5563]">
                {products.length} saved
              </span>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  setForm(emptyForm);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search inventory products"
            />
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Product name</th>
                <th className="w-24 px-3 py-3 text-right font-medium sm:w-32 sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t transition hover:bg-[#FAFAFB]">
                    <td className="min-w-0 px-3 py-4 font-semibold text-foreground sm:px-5">
                      <div className="truncate" title={product.title}>
                        {product.title}
                      </div>
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(product)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-[#F5F5F7] hover:text-foreground"
                          aria-label="Edit inventory product"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(product)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-[#FFF1F2] hover:text-[#E30613]"
                          aria-label="Delete inventory product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading inventory products..." : "No inventory products found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setForm(emptyForm);
        }}
      >
        <DialogContent className="w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit inventory product" : "Add inventory product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Product name">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className={inputCls}
                placeholder="HP EliteBook 840 G6"
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setForm(emptyForm);
                  setFormOpen(false);
                }}
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="button" className="rounded-full" onClick={save}>
                <Plus className="h-4 w-4" /> {form.id ? "Save changes" : "Save product"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
