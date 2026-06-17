import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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
  createProductCatalogueBatch,
  deleteProductCatalogueItem,
  listProductCatalogue,
  updateProductCatalogueItem,
} from "@/lib/admin-data";

export const Route = createFileRoute("/admin/catalogue")({ component: AdminCataloguePage });

const ITEM_OPTIONS = ["Laptop", "Monitor", "Printer", "Desktop", "Phone", "Accessory", "Other"];
const PROCESSOR_OPTIONS = ["Core i3", "Core i5", "Core i7", "Core i9", "Ultra 5", "Ultra 7", "Ultra 9", "Ryzen 3", "Ryzen 5", "Ryzen 7", "M1", "M2", "M3", "M4", "M5"];
const GENERATION_OPTIONS = ["6th Gen", "7th Gen", "8th Gen", "9th Gen", "10th Gen", "11th Gen", "12th Gen", "13th Gen", "14th Gen", "15th Gen", "16th Gen"];
const RAM_OPTIONS = ["4GB", "8GB", "16GB", "24GB", "32GB", "36GB", "48GB", "64GB"];
const STORAGE_OPTIONS = ["128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD", "2TB", "2TB SSD", "500GB HDD", "1TB HDD"];
const MONITOR_SIZE_OPTIONS = ["19 inch", "22 inch", "24 inch", "27 inch", "32 inch", "34 inch"];
const GENERIC_SPEC_OPTIONS = ["Standard", "Pro", "Max", "Refurbished", "Brand new"];

type VariantRow = {
  id: string;
  processor: string;
  generation: string;
  ram: string;
  storage: string;
  size: string;
  model: string;
};

export function AdminCataloguePage() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const showAddOnly = path === "/admin/catalogue/add";
  const showListOnly = path === "/admin/catalogue/list";
  const showAdd = !showListOnly;
  const showList = !showAddOnly;
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const [title, setTitle] = useState("");
  const [item, setItem] = useState("Laptop");
  const [customItem, setCustomItem] = useState("");
  const [variantRows, setVariantRows] = useState<VariantRow[]>([
    createVariantRow({ processor: "Core i7", ram: "4GB" }),
    createVariantRow({ processor: "Core i7", ram: "8GB" }),
  ]);
  const [search, setSearch] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    item: string;
    product_name: string;
    specs: VariantRow;
  } | null>(null);

  const { data: catalogue = [] } = useQuery({
    queryKey: ["product-catalogue"],
    queryFn: () => listProductCatalogue(),
  });
  const addVariantRow = () => setVariantRows((current) => [...current, createVariantRow()]);

  const filteredCatalogue = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogue.filter((entry) =>
      (websiteFilter === "all" ||
        (websiteFilter === "listed" && Boolean(entry.product_id)) ||
        (websiteFilter === "unlisted" && !entry.product_id)) &&
      (!query ||
        [entry.product_name, entry.title, entry.item, ...Object.values(entry.specs)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))),
    );
  }, [catalogue, search, websiteFilter]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredCatalogue.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedCatalogue = filteredCatalogue.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const save = async () => {
    if (!actor) return;
    const resolvedItem = item === "Other" ? customItem.trim() : item;
    const requiresSpecs = catalogueItemUsesSpecs(item);
    const parsedVariants = variantRows
      .map((row) => ({ specs: buildSpecsFromVariantRow(resolvedItem, row) }))
      .filter((variant) => Object.keys(variant.specs).length > 0);

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!resolvedItem) {
      toast.error("Item is required");
      return;
    }
    if (requiresSpecs && parsedVariants.length === 0) {
      toast.error("Add at least one spec variant");
      return;
    }

    try {
      const result = await createProductCatalogueBatch({
        title: title.trim(),
        item: resolvedItem,
        variants: requiresSpecs ? parsedVariants : [{ specs: { Name: title.trim() } }],
        actor,
      });
      toast.success(`${result.count} catalogue product(s) saved`);
      setTitle("");
      setVariantRows([createVariantRow()]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["product-catalogue"] }),
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save catalogue products");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this catalogue item? Existing website or inventory products will stay.")) return;
    await deleteProductCatalogueItem(id);
    toast.success("Catalogue item deleted");
    await qc.invalidateQueries({ queryKey: ["product-catalogue"] });
  };

  const startEdit = (entry: any) => {
    setEditing({
      id: entry.id,
      title: entry.title,
      item: entry.item,
      product_name: entry.product_name,
      specs: variantRowFromSpecs(entry.item, entry.specs),
    });
  };

  const saveEdit = async () => {
    if (!actor || !editing) return;
    const requiresSpecs = catalogueItemUsesSpecs(editing.item);
    const parsedSpecs = buildSpecsFromVariantRow(editing.item, editing.specs);

    if (!editing.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!editing.item.trim()) {
      toast.error("Item is required");
      return;
    }
    if (requiresSpecs && Object.keys(parsedSpecs).length === 0) {
      toast.error("Specs are required");
      return;
    }

    try {
      await updateProductCatalogueItem({
        id: editing.id,
        title: editing.title.trim(),
        item: editing.item.trim(),
        product_name: editing.product_name.trim(),
        specs: requiresSpecs ? parsedSpecs : { Name: editing.title.trim() },
        actor,
      });
      toast.success("Catalogue product updated");
      setEditing(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["product-catalogue"] }),
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update catalogue product");
    }
  };

  return (
    <div className="space-y-6">
      {showAdd ? <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FFF1F2] text-[#E30613]">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Add catalogue variants</h2>
            <p className="text-sm text-muted-foreground">
              Each spec line becomes a separate product name using title plus spec values.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Lenovo or Samsung" />
          </Field>
          <Field label="Item">
            <select
              value={item}
              onChange={(e) => {
                setItem(e.target.value);
                setVariantRows([createVariantRow()]);
              }}
              className={inputCls}
            >
              {ITEM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          {item === "Other" ? (
            <Field label="Custom item" className="lg:col-span-2">
              <input value={customItem} onChange={(e) => setCustomItem(e.target.value)} className={inputCls} placeholder="Projector" />
            </Field>
          ) : null}
          {catalogueItemUsesSpecs(item) ? <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spec variants</span>
              <Button type="button" variant="outline" className="h-9 rounded-full" onClick={addVariantRow}>
                <Plus className="h-4 w-4" /> Add row
              </Button>
            </div>
            <div className="space-y-3">
              {variantRows.map((row, index) => (
                <SpecDropdownRow
                  key={row.id}
                  item={item === "Other" ? customItem : item}
                  row={row}
                  onChange={(nextRow) =>
                    setVariantRows((current) => current.map((currentRow) => (currentRow.id === row.id ? nextRow : currentRow)))
                  }
                  onRemove={() => setVariantRows((current) => current.filter((currentRow) => currentRow.id !== row.id))}
                  canRemove={variantRows.length > 1}
                  label={`Variant ${index + 1}`}
                />
              ))}
            </div>
          </div> : null}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} className="rounded-full">
            <Plus className="h-4 w-4" /> Save variants
          </Button>
        </div>
        {showAdd && catalogueItemUsesSpecs(item) ? (
          <button
            type="button"
            onClick={addVariantRow}
            className="fixed bottom-6 right-5 z-[60] grid h-14 w-14 place-items-center rounded-full bg-[#E30613] text-white shadow-lg transition hover:bg-[#c70511] md:hidden"
            aria-label="Add catalogue variant row"
          >
            <Plus className="h-6 w-6" />
          </button>
        ) : null}
      </section> : null}

      {showList ? <section className="rounded-2xl border bg-card shadow-soft">
        <div className="border-b p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Catalogue products</h2>
              <p className="text-sm text-muted-foreground">All existing products and catalogue variants appear here.</p>
            </div>
            <Button asChild className="rounded-full">
              <Link to="/admin/catalogue/add">
                <Plus className="h-4 w-4" /> Add
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search catalogue products"
              />
            </div>
            <select
              value={websiteFilter}
              onChange={(e) => {
                setWebsiteFilter(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="all">All website statuses</option>
              <option value="listed">Listed on website</option>
              <option value="unlisted">Not listed on website</option>
            </select>
          </div>
        </div>
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium sm:px-5">Product name</th>
                <th className="w-24 px-3 py-3 text-right font-medium sm:w-28 sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCatalogue.length > 0 ? (
                paginatedCatalogue.map((entry) => (
                  <tr key={entry.id} className="border-t">
                    <td className="min-w-0 px-3 py-4 font-semibold text-foreground sm:px-5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate" title={entry.product_name}>
                          {entry.product_name}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            entry.product_id ? "bg-[#ECFDF3] text-[#15803D]" : "bg-[#FFF7ED] text-[#C2410C]"
                          }`}
                        >
                          {entry.product_id ? "Listed" : "Unlisted"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-[#F5F5F7] hover:text-foreground"
                          aria-label="Edit catalogue item"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      <button
                        type="button"
                        onClick={() => remove(entry.id)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-[#FFF1F2] hover:text-[#E30613]"
                        aria-label="Delete catalogue item"
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
                    No catalogue products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredCatalogue.length > 0 ? (
          <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredCatalogue.length)} of {filteredCatalogue.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="min-w-20 text-center text-xs font-semibold text-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section> : null}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit catalogue product</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Title">
                <input
                  value={editing.title}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Item">
                <select
                  value={editing.item}
                  onChange={(event) => setEditing({ ...editing, item: event.target.value, specs: createVariantRow() })}
                  className={inputCls}
                >
                  {ITEM_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Product name" className="lg:col-span-2">
                <input
                  value={editing.product_name}
                  onChange={(event) => setEditing({ ...editing, product_name: event.target.value })}
                  className={inputCls}
                />
              </Field>
              {catalogueItemUsesSpecs(editing.item) ? <div className="lg:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specs</span>
                <SpecDropdownRow
                  item={editing.item}
                  row={editing.specs}
                  onChange={(nextRow) => setEditing({ ...editing, specs: nextRow })}
                  label="Selected specs"
                />
              </div> : null}
              <div className="flex justify-end lg:col-span-2">
                <Button onClick={saveEdit} className="rounded-full">Save changes</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpecDropdownRow({
  item,
  row,
  label,
  onChange,
  onRemove,
  canRemove = false,
}: {
  item: string;
  row: VariantRow;
  label: string;
  onChange: (row: VariantRow) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  const normalizedItem = String(item ?? "").trim().toLowerCase();
  const isMonitor = normalizedItem.includes("monitor");
  const isLaptop = normalizedItem.includes("laptop") || normalizedItem.includes("desktop");

  return (
    <div className="rounded-2xl border bg-[#F8FAFC] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {canRemove && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-white hover:text-[#E30613]"
            aria-label="Remove spec row"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isMonitor ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Size" value={row.size} options={MONITOR_SIZE_OPTIONS} onChange={(size) => onChange({ ...row, size })} />
        </div>
      ) : isLaptop ? (
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Processor" value={row.processor} options={PROCESSOR_OPTIONS} onChange={(processor) => onChange({ ...row, processor })} />
          <SelectField label="Generation" value={row.generation} options={GENERATION_OPTIONS} onChange={(generation) => onChange({ ...row, generation })} />
          <SelectField label="RAM" value={row.ram} options={RAM_OPTIONS} onChange={(ram) => onChange({ ...row, ram })} />
          <SelectField label="Storage" value={row.storage} options={STORAGE_OPTIONS} onChange={(storage) => onChange({ ...row, storage })} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Model" value={row.model} options={GENERIC_SPEC_OPTIONS} onChange={(model) => onChange({ ...row, model })} />
          <SelectField label="Size" value={row.size} options={MONITOR_SIZE_OPTIONS} onChange={(size) => onChange({ ...row, size })} />
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputCls}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function createVariantRow(input: Partial<VariantRow> = {}): VariantRow {
  return {
    id: `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    processor: input.processor ?? "",
    generation: input.generation ?? "",
    ram: input.ram ?? "",
    storage: input.storage ?? "",
    size: input.size ?? "",
    model: input.model ?? "",
  };
}

function buildSpecsFromVariantRow(item: string, row: VariantRow) {
  const normalizedItem = String(item ?? "").trim().toLowerCase();
  const specs: Record<string, string> = {};

  if ((normalizedItem.includes("laptop") || normalizedItem.includes("desktop")) && row.processor) {
    specs.Processor = row.processor;
  }
  if ((normalizedItem.includes("laptop") || normalizedItem.includes("desktop")) && row.generation) {
    specs.Generation = row.generation;
  }
  if ((normalizedItem.includes("laptop") || normalizedItem.includes("desktop")) && row.ram) {
    specs.RAM = row.ram;
  }
  if ((normalizedItem.includes("laptop") || normalizedItem.includes("desktop")) && row.storage) {
    specs.Storage = row.storage;
  }
  if (normalizedItem.includes("monitor") && row.size) {
    specs.Size = row.size;
  }
  if (!normalizedItem.includes("laptop") && !normalizedItem.includes("desktop") && !normalizedItem.includes("monitor")) {
    if (normalizedItem === "other") return specs;
    if (row.model) specs.Model = row.model;
    if (row.size) specs.Size = row.size;
  }
  return specs;
}

function variantRowFromSpecs(item: string, specs: Record<string, string>) {
  const normalizedSpecs = Object.fromEntries(
    Object.entries(specs ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );

  return createVariantRow({
    processor: normalizedSpecs.processor ?? "",
    generation: normalizedSpecs.generation ?? normalizedSpecs.gen ?? "",
    ram: normalizedSpecs.ram ?? normalizedSpecs["ram (gb)"] ?? "",
    storage: normalizedSpecs.storage ?? "",
    size: normalizedSpecs.size ?? normalizedSpecs["screen size (in)"] ?? "",
    model: normalizedSpecs.model ?? normalizedSpecs.condition ?? "",
  });
}

function catalogueItemUsesSpecs(item: string) {
  const normalizedItem = String(item ?? "").trim().toLowerCase();
  return normalizedItem.includes("laptop") || normalizedItem.includes("desktop") || normalizedItem.includes("monitor");
}

function formatSpecs(specs: Record<string, string>) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return "-";
  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
