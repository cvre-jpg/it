import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import { listSupplierFinanceRecords, listSuppliers } from "@/lib/admin-data";
import { formatKES } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/finance/records")({
  component: AdminFinanceRecords,
});

const PERIOD_OPTIONS = [
  { value: "month", label: "This month" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

type PaymentStatus = "paid" | "partial" | "unpaid" | "invalid";
type InventoryStatus = "in_stock" | "sold" | "returned" | "takeout";

function AdminFinanceRecords() {
  const [supplierId, setSupplierId] = useState("");
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["value"]>("month");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [inventoryStatus, setInventoryStatus] = useState<"all" | InventoryStatus>("all");
  const [serialSearch, setSerialSearch] = useState("");
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-finance-records", supplierId, period],
    queryFn: () => listSupplierFinanceRecords({ supplier_id: supplierId, period }),
  });

  const records = data?.records ?? [];
  const filteredRecords = useMemo(
    () => {
      const normalizedSearch = serialSearch.trim().toLowerCase();
      return records.filter(
        (record) => {
          const serialCode = String(record.serial_code ?? "").toLowerCase();
          return (
          (status === "all" || record.status === status) &&
            (inventoryStatus === "all" || record.inventory_status === inventoryStatus) &&
            (!normalizedSearch || serialCode.includes(normalizedSearch))
          );
        },
      );
    },
    [inventoryStatus, records, serialSearch, status],
  );
  const activeRecord = records.find((record) => record.stock_intake_id === activeRecordId) ?? null;
  const openRecordDetails = (event: React.MouseEvent<HTMLButtonElement>, recordId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveRecordId(recordId);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Finance Records</h1>
        <p className="text-sm text-muted-foreground">
          Review supplier stock payments, remaining balances, and paid or unpaid products.
        </p>
      </header>

      <section className="hidden rounded-2xl border bg-card p-5 shadow-soft md:block">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Supplier">
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputCls}>
              <option value="">All suppliers</option>
              {suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as (typeof PERIOD_OPTIONS)[number]["value"])}
              className={inputCls}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inventory status">
            <select
              value={inventoryStatus}
              onChange={(event) => setInventoryStatus(event.target.value as typeof inventoryStatus)}
              className={inputCls}
            >
              <option value="all">All inventory statuses</option>
              <option value="in_stock">In stock</option>
              <option value="sold">Sold</option>
              <option value="returned">Returned</option>
              <option value="takeout">Take-out</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputCls}>
              <option value="all">All payment statuses</option>
              <option value="paid">Paid serials</option>
              <option value="partial">Partial serials</option>
              <option value="unpaid">Unpaid serials</option>
              <option value="invalid">Invalid serials</option>
            </select>
          </Field>
          <Field label="Serial number">
            <input
              type="search"
              value={serialSearch}
              onChange={(event) => setSerialSearch(event.target.value)}
              placeholder="Search serial"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setMobileFiltersOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        aria-label="Open filters"
      >
        <Filter className="h-5 w-5" />
      </button>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[86vw] max-w-sm overflow-y-auto bg-background p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F5F5F7] hover:text-[#111827]"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Supplier">
                <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputCls}>
                  <option value="">All suppliers</option>
                  {suppliers.map((supplier: any) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Period">
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as (typeof PERIOD_OPTIONS)[number]["value"])}
                  className={inputCls}
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Inventory status">
                <select
                  value={inventoryStatus}
                  onChange={(event) => setInventoryStatus(event.target.value as typeof inventoryStatus)}
                  className={inputCls}
                >
                  <option value="all">All inventory statuses</option>
                  <option value="in_stock">In stock</option>
                  <option value="sold">Sold</option>
                  <option value="returned">Returned</option>
                  <option value="takeout">Take-out</option>
                </select>
              </Field>
              <Field label="Status">
                <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputCls}>
                  <option value="all">All payment statuses</option>
                  <option value="paid">Paid serials</option>
                  <option value="partial">Partial serials</option>
                  <option value="unpaid">Unpaid serials</option>
                  <option value="invalid">Invalid serials</option>
                </select>
              </Field>
              <Field label="Serial number">
                <input
                  type="search"
                  value={serialSearch}
                  onChange={(event) => setSerialSearch(event.target.value)}
                  placeholder="Search serial"
                  className={inputCls}
                />
              </Field>
            </div>
          </aside>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="Amount paid" value={formatKES(data?.summary.amount_paid ?? 0)} />
        <SummaryCard label="Amount remaining" value={formatKES(data?.summary.amount_remaining ?? 0)} />
        <SummaryCard label="Paid serials" value={String(data?.summary.paid_products ?? 0)} />
        <SummaryCard label="Unpaid serials" value={String(data?.summary.unpaid_products ?? 0)} />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Supplier Serial Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product name</th>
                <th>Serial code</th>
                <th>Inventory status</th>
                <th>Payment status</th>
                <th className="px-4 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.stock_intake_id} className="border-t">
                  <td className="max-w-[180px] px-4 py-3 sm:max-w-[260px]" onClick={(event) => event.stopPropagation()}>
                    <p className="truncate font-medium" title={record.product_title}>{record.product_title}</p>
                  </td>
                  <td className="font-mono text-xs">{record.serial_code}</td>
                  <td>{inventoryStatusBadge(record.inventory_status)}</td>
                  <td>{paymentStatusBadge(record.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => openRecordDetails(event, record.stock_intake_id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4B5563] transition hover:bg-[#F5F5F7] hover:text-[#111827]"
                      aria-label="View finance record details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    {isLoading
                        ? "Loading finance records..."
                        : "No finance records match the current filters."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(activeRecord)} onOpenChange={(open) => !open && setActiveRecordId(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl p-4 sm:p-5">
          {activeRecord ? (
            <>
              <DialogHeader className="min-w-0">
                <DialogTitle className="break-words pr-6">{activeRecord.product_title}</DialogTitle>
                <DialogDescription className="break-words pr-6">
                  Serial {activeRecord.serial_code} from {activeRecord.supplier_name ?? "supplier"}
                </DialogDescription>
              </DialogHeader>

              <div className="min-w-0 space-y-4">
                <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                  <DetailItem label="Product name" value={activeRecord.product_title} />
                  <DetailItem label="Serial number" value={activeRecord.serial_code} mono />
                  <DetailItem label="Supplier" value={activeRecord.supplier_name ?? "-"} />
                  <DetailItem label="Received date" value={formatDate(activeRecord.received_at)} />
                  <DetailItem label="Inventory status" value={inventoryStatusLabel(activeRecord.inventory_status)} />
                  <DetailItem label="Payment status" value={paymentStatusLabel(activeRecord.status)} />
                  <DetailItem label="Amount paid" value={formatKES(activeRecord.amount_paid)} />
                  <DetailItem
                    label="Amount remaining"
                    value={
                      activeRecord.amount_remaining == null
                        ? "Set price needed"
                        : formatKES(activeRecord.amount_remaining)
                    }
                  />
                  <DetailItem
                    label="Set price"
                    value={
                      activeRecord.amount_remaining == null
                        ? "Set price needed"
                        : formatKES(activeRecord.amount_paid + activeRecord.amount_remaining)
                    }
                  />
                  <DetailItem
                    label="Last payment"
                    value={activeRecord.last_payment_date ? formatDate(activeRecord.last_payment_date) : "-"}
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Payment history
                  </p>
                  <div className="max-w-full overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[540px] text-xs">
                      <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th>Bill</th>
                          <th>Paid</th>
                          <th>Before</th>
                          <th>After</th>
                          <th>Recorded by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRecord.payment_history.map((payment) => (
                          <tr key={payment.id} className="border-t">
                            <td className="px-3 py-2">
                              {payment.bill_date ? formatDate(payment.bill_date) : payment.created_at ? formatDate(payment.created_at) : "-"}
                            </td>
                            <td>{payment.bill_number ?? "-"}</td>
                            <td className="font-semibold">{formatKES(payment.amount)}</td>
                            <td>{payment.balance_before == null ? "-" : formatKES(payment.balance_before)}</td>
                            <td>{payment.balance_after == null ? "-" : formatKES(payment.balance_after)}</td>
                            <td>{payment.recorded_by ?? "-"}</td>
                          </tr>
                        ))}
                        {activeRecord.payment_history.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                              No payments have been recorded for this serial.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#111827]">{value}</p>
    </div>
  );
}

function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-[#F8FAFC] p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-sm font-semibold text-[#111827] ${mono ? "break-all font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

function inventoryStatusBadge(status: string) {
  const normalized = String(status ?? "in_stock");
  const className =
    normalized === "in_stock"
      ? "bg-emerald-50 text-emerald-700"
      : normalized === "sold"
        ? "bg-blue-50 text-blue-700"
        : normalized === "returned"
          ? "bg-slate-100 text-slate-700"
          : "bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{inventoryStatusLabel(normalized)}</span>;
}

function paymentStatusBadge(status: PaymentStatus) {
  const className =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700"
      : status === "partial"
        ? "bg-blue-50 text-blue-700"
        : status === "invalid"
          ? "bg-rose-50 text-rose-700"
          : "bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{paymentStatusLabel(status)}</span>;
}

function inventoryStatusLabel(status: string) {
  const normalized = String(status ?? "in_stock");
  return normalized === "in_stock" ? "In stock" : normalized === "takeout" ? "Take-out" : capitalize(normalized);
}

function paymentStatusLabel(status: PaymentStatus) {
  return status === "paid" ? "Paid" : status === "partial" ? "Partial" : status === "invalid" ? "Invalid" : "Unpaid";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
