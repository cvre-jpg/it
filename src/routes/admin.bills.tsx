import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listSupplierBills,
  listSupplierBillStockOptions,
  listSuppliers,
  updateStockIntakeMeta,
  upsertSupplierBill,
} from "@/lib/admin-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/admin/bills")({ component: AdminBills });

function AdminBills() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    supplier_id: "",
    product_id: "",
    stock_intake_ids: [] as string[],
    bill_date: today(),
    amount: "",
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [setPricePrompt, setSetPricePrompt] = useState<{
    stock_intake_id: string;
    serial_code: string;
    price: string;
  } | null>(null);
  const [activeBill, setActiveBill] = useState<any | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["supplier-bills"],
    queryFn: () => listSupplierBills(),
  });
  const { data: stockOptions = [] } = useQuery({
    queryKey: ["supplier-bill-stock-options", form.supplier_id],
    queryFn: () => listSupplierBillStockOptions(form.supplier_id),
    enabled: Boolean(form.supplier_id),
  });

  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const isSuperAdmin = user?.role === "super_admin";
  const productOptions = useMemo(() => {
    const unique = new Map<string, { id: string; title: string; set_price: number | null }>();
    stockOptions.forEach((stock: any) => {
      if (!unique.has(stock.product_id)) {
        unique.set(stock.product_id, {
          id: stock.product_id,
          title: stock.product_title,
          set_price: stock.set_price,
        });
      }
    });
    return Array.from(unique.values());
  }, [stockOptions]);
  const serialOptions = useMemo(
    () => stockOptions.filter((stock: any) => String(stock.product_id) === form.product_id),
    [form.product_id, stockOptions],
  );
  const selectedStocks = useMemo(
    () => stockOptions.filter((stock: any) => form.stock_intake_ids.includes(String(stock.stock_intake_id))),
    [form.stock_intake_ids, stockOptions],
  );
  const selectedBalance = useMemo(
    () => selectedStocks.reduce((total: number, stock: any) => total + Number(stock.remaining_stock_price ?? 0), 0),
    [selectedStocks],
  );
  const filteredBills = useMemo(() => {
    return bills.filter((bill: any) => {
      const matchesSearch = matchesQuery(
        search,
        bill.bill_number,
        bill.supplier_name,
        bill.product_title,
        bill.serial_code,
        bill.created_by_name,
      );
      const matchesSupplier =
        supplierFilter === "all" || String(bill.supplier_id ?? "") === supplierFilter;
      const matchesRange =
        rangeFilter === "all" || isWithinDays(bill.bill_date, Number(rangeFilter));

      return matchesSearch && matchesSupplier && matchesRange;
    });
  }, [bills, rangeFilter, search, supplierFilter]);

  const save = async () => {
    if (!actor) return;
    if (!form.supplier_id || !form.product_id || form.stock_intake_ids.length === 0 || !form.amount) {
      toast.error("Supplier, product, serial number, and amount are required");
      return;
    }
    if (selectedStocks.some((stock: any) => needsSetPrice(stock))) {
      toast.error("Set price for selected serial numbers first");
      return;
    }
    const paidAmount = Number(form.amount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      toast.error("Amount paid must be greater than zero");
      return;
    }
    if (paidAmount > selectedBalance) {
      toast.error("Amount paid cannot exceed the selected serial set price");
      return;
    }

    try {
      const result = await upsertSupplierBill({
        supplier_id: form.supplier_id,
        product_id: form.product_id,
        stock_intake_ids: form.stock_intake_ids,
        serial_code: selectedStocks.map((stock: any) => String(stock.serial_code ?? "")).filter(Boolean).join(", "),
        bill_date: form.bill_date,
        due_date: null,
        amount: paidAmount,
        status: "part_paid",
        notes: form.notes || null,
        actor,
      });

      toast.success(`Supplier bill recorded: ${result.bill_number ?? "Bill created"}`);
      setForm({
        supplier_id: "",
        product_id: "",
        stock_intake_ids: [],
        bill_date: today(),
        amount: "",
        notes: "",
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["supplier-bills"] }),
        qc.invalidateQueries({ queryKey: ["supplier-bill-stock-options"] }),
        qc.invalidateQueries({ queryKey: ["inventory-products"] }),
        qc.invalidateQueries({ queryKey: ["inventory-records"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save supplier bill");
    }
  };

  const toggleSerial = (stock: any, checked: boolean) => {
    const stockIntakeId = String(stock.stock_intake_id);
    if (!checked) {
      setForm((current) => ({
        ...current,
        amount: "",
        stock_intake_ids: current.stock_intake_ids.filter((id) => id !== stockIntakeId),
      }));
      return;
    }

    if (needsSetPrice(stock)) {
      if (!isSuperAdmin) {
        toast.error("Only super admin can set prices");
        return;
      }
      setSetPricePrompt({
        stock_intake_id: stockIntakeId,
        serial_code: String(stock.serial_code ?? ""),
        price: "",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      amount: "",
      stock_intake_ids: current.stock_intake_ids.includes(stockIntakeId)
        ? current.stock_intake_ids
        : [...current.stock_intake_ids, stockIntakeId],
    }));
  };

  const savePromptSetPrice = async () => {
    if (!actor || !setPricePrompt) return;
    if (!isSuperAdmin) {
      toast.error("Only super admin can set prices");
      return;
    }
    const price = Number(setPricePrompt.price);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a set price greater than zero");
      return;
    }

    try {
      await updateStockIntakeMeta({
        ids: [setPricePrompt.stock_intake_id],
        stock_price: price,
        due_date: null,
        actor,
      });
      setForm((current) => ({
        ...current,
        amount: "",
        stock_intake_ids: current.stock_intake_ids.includes(setPricePrompt.stock_intake_id)
          ? current.stock_intake_ids
          : [...current.stock_intake_ids, setPricePrompt.stock_intake_id],
      }));
      toast.success("Set price saved");
      setSetPricePrompt(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["supplier-bill-stock-options"] }),
        qc.invalidateQueries({ queryKey: ["inventory-records"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save set price");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Supplier Bills</h1>
        <p className="text-sm text-muted-foreground">Track procurement bills, due dates, and payable status.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Record Bill</h2>
          <div className="mt-4 space-y-3">
            <Field label="Supplier">
              <select
                value={form.supplier_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    supplier_id: e.target.value,
                    product_id: "",
                    stock_intake_ids: [],
                    amount: "",
                  })
                }
                className={inputCls}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <select
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value, stock_intake_ids: [], amount: "" })}
                className={inputCls}
                disabled={!form.supplier_id}
              >
                <option value="">{form.supplier_id ? "Select product" : "Select supplier first"}</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Serial numbers">
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border bg-background p-2">
                {!form.product_id ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Select product first</p>
                ) : serialOptions.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">No unpaid serial numbers</p>
                ) : (
                  serialOptions.map((stock: any) => {
                    const stockIntakeId = String(stock.stock_intake_id);
                    const checked = form.stock_intake_ids.includes(stockIntakeId);
                    return (
                      <button
                        type="button"
                        key={stockIntakeId}
                        onClick={() => toggleSerial(stock, !checked)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        aria-pressed={checked}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs">{stock.serial_code}</span>
                          <span className="text-xs text-muted-foreground">
                            {needsSetPrice(stock)
                              ? "Set price needed"
                              : `Balance ${formatKES(Number(stock.remaining_stock_price ?? 0))}`}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          tabIndex={-1}
                          className="h-4 w-4 rounded border-border"
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </Field>
            <Field label="Bill number">
              <input value="Auto generated" readOnly className={`${inputCls} bg-[#F8FAFC] text-muted-foreground`} />
            </Field>
            <Field label="Bill date">
              <input
                type="date"
                value={form.bill_date}
                onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Amount paid (KES)">
              <input
                type="number"
                min="0"
                max={selectedBalance || undefined}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={inputCls}
              />
              {selectedStocks.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected balance before payment {formatKES(selectedBalance)}
                </p>
              ) : null}
            </Field>
            <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
            <Button className="w-full rounded-full" onClick={save}>Save bill</Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="border-b p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_180px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls}
                placeholder="Search bill number, supplier, product, or serial"
              />
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">All suppliers</option>
                {suppliers.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <select
                value={rangeFilter}
                onChange={(e) => setRangeFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Bill</th>
                <th>Supplier</th>
                <th>Product</th>
                <th>Serial</th>
                <th>Amount</th>
                <th>Remaining</th>
                <th className="px-4 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill: any) => (
                <tr key={bill.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{bill.bill_number}</p>
                    <p className="text-xs text-muted-foreground">Issued {formatDate(bill.bill_date)}</p>
                  </td>
                  <td>{bill.supplier_name ?? "-"}</td>
                  <td>{bill.product_title ?? "-"}</td>
                  <td className="font-mono text-xs">{bill.serial_code ?? "-"}</td>
                  <td className="font-semibold">{formatKES(bill.amount)}</td>
                  <td className="font-semibold">
                    {bill.remaining_stock_price == null ? "-" : formatKES(Number(bill.remaining_stock_price))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setActiveBill(bill)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4B5563] transition hover:bg-[#F5F5F7] hover:text-[#111827]"
                      aria-label="View bill details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No bills match the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(setPricePrompt)} onOpenChange={(open) => !open && setSetPricePrompt(null)}>
        <DialogContent className="w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Set serial price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Serial {setPricePrompt?.serial_code || "-"} needs a set price before it can be billed.
            </p>
            <Field label="Set price (KES)">
              <input
                type="number"
                min="1"
                step="1"
                value={setPricePrompt?.price ?? ""}
                onChange={(event) =>
                  setSetPricePrompt((current) =>
                    current ? { ...current, price: event.target.value } : current,
                  )
                }
                className={inputCls}
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setSetPricePrompt(null)}>
                Cancel
              </Button>
              <Button type="button" className="rounded-full" onClick={savePromptSetPrice}>
                Save set price
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeBill)} onOpenChange={(open) => !open && setActiveBill(null)}>
        <DialogContent className="w-[90vw] max-w-2xl rounded-2xl">
          {activeBill ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeBill.bill_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <BillDetail label="Supplier" value={activeBill.supplier_name ?? "-"} />
                  <BillDetail label="Product" value={activeBill.product_title ?? "-"} />
                  <BillDetail label="Bill date" value={formatDate(activeBill.bill_date)} />
                  <BillDetail label="Status" value={capitalizeStatus(activeBill.status)} />
                  <BillDetail label="Amount paid" value={formatKES(Number(activeBill.amount ?? 0))} />
                  <BillDetail
                    label="Opening balance"
                    value={
                      activeBill.opening_stock_price == null
                        ? "-"
                        : formatKES(Number(activeBill.opening_stock_price))
                    }
                  />
                  <BillDetail
                    label="Remaining balance"
                    value={
                      activeBill.remaining_stock_price == null
                        ? "-"
                        : formatKES(Number(activeBill.remaining_stock_price))
                    }
                  />
                  <BillDetail label="Recorded by" value={activeBill.created_by_name ?? "-"} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Serial numbers</p>
                  <div className="rounded-xl border bg-[#F8FAFC] p-3 font-mono text-xs leading-6 text-[#0F172A]">
                    {activeBill.serial_code ?? "-"}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Notes</p>
                  <div className="min-h-16 rounded-xl border bg-[#F8FAFC] p-3 text-sm text-[#111827]">
                    {activeBill.notes ?? "-"}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function BillDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-[#F8FAFC] p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

function matchesQuery(query: string, ...values: Array<unknown>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}

function capitalizeStatus(value: string) {
  return String(value ?? "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isWithinDays(value: string, days: number) {
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;
  const todayDate = new Date();
  const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const diff = start.getTime() - target.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days - 1;
}

function needsSetPrice(stock: any) {
  return stock.set_price == null || stock.remaining_stock_price == null;
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
