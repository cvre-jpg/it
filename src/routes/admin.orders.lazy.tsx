import { createLazyFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { openWhatsAppConversation } from "@/lib/whatsapp";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search, Trash2, X } from "lucide-react";
import { formatKES } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  createAdminOrder,
  deleteAdminOrder,
  exportAdminOrders,
  listAdminOrders,
  listAdminProducts,
  listInventoryRecords,
  listProductCatalogue,
  listProductSerialOptions,
  listSuppliers,
} from "@/lib/admin-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createLazyFileRoute("/admin/orders")({ component: AdminOrders });

const SOURCES = [
  { label: "Website", value: "website" },
  { label: "Walk-in", value: "walkin" },
  { label: "Delivery", value: "delivery" },
  { label: "TikTok", value: "tiktok" },
  { label: "Instagram", value: "instagram" },
  { label: "Referall", value: "referall" },
  { label: "Returning", value: "returning" },
] as const;
const PAYMENT_METHODS = [
  { label: "Cash", value: "cash" },
  { label: "I&M Bank", value: "im_bank" },
  { label: "Family Bank", value: "family_bank" },
  { label: "Stanbic Bank", value: "stanbic_bank" },
] as const;
const SORTS = [
  { label: "Newest first", value: "date-desc" },
  { label: "Oldest first", value: "date-asc" },
  { label: "Highest amount", value: "total-desc" },
  { label: "Lowest amount", value: "total-asc" },
  { label: "Customer A-Z", value: "name-asc" },
  { label: "Customer Z-A", value: "name-desc" },
] as const;
const TIME_RANGES = [
  { label: "All time", value: "all" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
] as const;
const PAGE_SIZE = 20;

type OrderLine = {
  product_id: string;
  title: string;
  serial_number: string;
  qty: number;
  price: string;
  custom_inventory?: {
    product_name: string;
    supplier_id: string;
    serial_code: string;
    catalogue_id?: string | null;
  } | null;
};

export function AdminOrdersPage() {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const orderPrefillSearch = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const showCreate = path === "/admin/orders" || path === "/admin/orders/create";
  const showList = path === "/admin/orders" || path === "/admin/orders/list";
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | (typeof SOURCES)[number]["value"]>("all");
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]["value"]>("all");
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]["value"]>("date-desc");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [serialOptionsByProduct, setSerialOptionsByProduct] = useState<
    Record<string, Array<{ serial_code: string; received_at: string; stock_status: string }>>
  >({});
  const [loadingSerialProductIds, setLoadingSerialProductIds] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    source: "walkin" as (typeof SOURCES)[number]["value"],
    payment_method: "cash" as (typeof PAYMENT_METHODS)[number]["value"],
    warranty: "",
    message: "",
  });
  const [lines, setLines] = useState<OrderLine[]>([createEmptyLine()]);
  const [appliedPrefillKey, setAppliedPrefillKey] = useState("");
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState<number | null>(null);
  const [customProduct, setCustomProduct] = useState<{
    lineIndex: number | null;
    product_name: string;
    supplier_id: string;
    serial_code: string;
    catalogue_id: string;
  }>({
    lineIndex: null,
    product_name: "",
    supplier_id: "",
    serial_code: "",
    catalogue_id: "",
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listAdminOrders(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listAdminProducts(),
  });
  const { data: catalogueProducts = [] } = useQuery({
    queryKey: ["product-catalogue"],
    queryFn: () => listProductCatalogue(),
  });
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-records"],
    queryFn: () => listInventoryRecords(),
  });
  const inventoryProducts = useMemo(() => buildInventoryProductOptions(inventoryData?.intake ?? [], products), [
    inventoryData?.intake,
    products,
  ]);

  const orderTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Math.max(1, Number(line.qty) || 1);
        const price = Math.max(0, Number(line.price) || 0);
        return sum + qty * price;
      }, 0),
    [lines],
  );

  const createOrder = useMutation({
    mutationFn: async () => {
      const validItems = lines
        .map((line, lineIndex) => {
          const title = line.title.trim();
          const customInventory = line.custom_inventory;
          if (!line.product_id && title && !customInventory) {
            setCustomProduct({
              lineIndex,
              product_name: title,
              supplier_id: "",
              serial_code: "",
              catalogue_id: "",
            });
            throw new Error("Complete custom product stock details");
          }

          return {
            id: line.product_id || undefined,
            title,
            serial_number: line.product_id
              ? line.serial_number.trim() || undefined
              : customInventory?.serial_code || undefined,
            qty: Math.max(1, Number(line.qty) || 1),
            price: Math.max(0, Number(line.price) || 0),
            custom_inventory: customInventory ?? undefined,
          };
        })
        .filter((line) => line.title && line.price >= 0);

      if (validItems.length === 0) {
        throw new Error("Add at least one product");
      }

      if (orderTotal <= 0) {
        throw new Error("Order total must be greater than zero");
      }

      return createAdminOrder({
        customer_name: form.customer_name.trim() || null,
        customer_phone: form.customer_phone.trim() || null,
        total: orderTotal,
        source: form.source,
        payment_method: form.payment_method,
        warranty: normalizeWarrantyMonths(form.warranty),
        message: form.message.trim() || null,
        items: validItems,
        actor: user ? { email: user.email, name: user.name, role: user.role } : null,
      });
    },
    onSuccess: () => {
      toast.success("Order recorded");
      setForm({
        customer_name: "",
        customer_phone: "",
        source: "walkin",
        payment_method: "cash",
        warranty: "",
        message: "",
      });
      setLines([createEmptyLine()]);
      closeCustomProductDialog();
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-records"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to record order");
    },
  });

  const removeOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return deleteAdminOrder(orderId);
    },
    onSuccess: () => {
      toast.success("Order deleted");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete order");
    },
  });

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();

    const next = orders.filter((order: any) => {
      const matchesSource = sourceFilter === "all" || order.source === sourceFilter;
      if (!matchesSource) return false;

      if (timeRange !== "all") {
        const createdAt = new Date(order.created_at).getTime();
        const maxAge = Number(timeRange) * 24 * 60 * 60 * 1000;
        if (Number.isNaN(createdAt) || now - createdAt > maxAge) {
          return false;
        }
      }

      if (!normalizedQuery) return true;

      const haystack = [
        String(order.id ?? ""),
        formatOrderNumber(order.id),
        order.customer_name,
        order.customer_phone,
        order.source,
        formatPaymentMethod(order.payment_method),
        formatWarranty(order.warranty),
        order.warranty,
        order.message,
        ...(Array.isArray(order.items) ? order.items.flatMap((item: any) => [item?.title, item?.serial_number]) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    next.sort((a: any, b: any) => {
      if (sortBy === "date-desc") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sortBy === "date-asc") return +new Date(a.created_at) - +new Date(b.created_at);
      if (sortBy === "total-desc") return Number(b.total) - Number(a.total);
      if (sortBy === "total-asc") return Number(a.total) - Number(b.total);
      if (sortBy === "name-asc") return String(a.customer_name || "Anonymous").localeCompare(String(b.customer_name || "Anonymous"));
      if (sortBy === "name-desc") return String(b.customer_name || "Anonymous").localeCompare(String(a.customer_name || "Anonymous"));
      return 0;
    });

    return next;
  }, [orders, query, sortBy, sourceFilter, timeRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const fetchSerialOptions = async (productId: string, selectedSerial = "", force = false) => {
    if (!productId) return;
    if (!force && serialOptionsByProduct[productId]) {
      if (selectedSerial) {
        setSerialOptionsByProduct((current) => ({
          ...current,
          [productId]: withSelectedSerialOption(current[productId] ?? [], selectedSerial),
        }));
      }
      return;
    }
    if (loadingSerialProductIds[productId]) return;

    try {
      setLoadingSerialProductIds((current) => ({ ...current, [productId]: true }));
      const serials = await listProductSerialOptions(productId);
      setSerialOptionsByProduct((current) => ({
        ...current,
        [productId]: withSelectedSerialOption(serials, selectedSerial),
      }));
    } catch (error) {
      console.error(error);
      toast.error("Could not load serial numbers for this product");
    } finally {
      setLoadingSerialProductIds((current) => ({ ...current, [productId]: false }));
    }
  };

  const selectOrderProduct = async (
    lineIndex: number,
    product: OrderProductSuggestion,
  ) => {
    if (product.source !== "inventory") {
      setLines((current) =>
        current.map((entry, entryIndex) =>
          entryIndex === lineIndex
            ? {
                ...entry,
                product_id: "",
                title: product.title,
                price: "",
                serial_number: "",
                custom_inventory: null,
              }
            : entry,
        ),
      );
      setActiveProductSearchIndex(null);
      setCustomProduct({
        lineIndex,
        product_name: product.title,
        supplier_id: "",
        serial_code: "",
        catalogue_id: product.catalogueId ?? "",
      });
      return;
    }

    setLines((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === lineIndex
          ? {
              ...entry,
              product_id: product.id,
              title: product.title,
              price: "",
              serial_number: "",
              custom_inventory: null,
            }
          : entry,
      ),
    );
    await fetchSerialOptions(product.id, "", true);
  };

  const openCustomProductDialog = (lineIndex: number) => {
    const line = lines[lineIndex] ?? createEmptyLine();
    setActiveProductSearchIndex(null);
    setCustomProduct({
      lineIndex,
      product_name: line.title.trim(),
      supplier_id: line.custom_inventory?.supplier_id ?? "",
      serial_code: line.custom_inventory?.serial_code ?? "",
      catalogue_id: line.custom_inventory?.catalogue_id ?? "",
    });
  };

  const closeCustomProductDialog = () => {
    setCustomProduct({
      lineIndex: null,
      product_name: "",
      supplier_id: "",
      serial_code: "",
      catalogue_id: "",
    });
  };

  const saveCustomProductDetails = () => {
    const lineIndex = customProduct.lineIndex;
    const productName = customProduct.product_name.trim();
    const supplierId = customProduct.supplier_id.trim();
    const serialCode = customProduct.serial_code.trim();

    if (lineIndex == null) return;
    if (!productName) {
      toast.error("Product name is required");
      return;
    }
    if (!supplierId) {
      toast.error("Supplier is required");
      return;
    }
    if (!serialCode) {
      toast.error("Serial code is required");
      return;
    }

    setLines((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === lineIndex
          ? {
              ...entry,
              product_id: "",
              title: productName,
              serial_number: serialCode,
              custom_inventory: {
                product_name: productName,
                supplier_id: supplierId,
                serial_code: serialCode,
                catalogue_id: customProduct.catalogue_id || null,
              },
            }
          : entry,
      ),
    );
    closeCustomProductDialog();
  };

  useEffect(() => {
    const productIds = Array.from(
      new Set(lines.map((line) => line.product_id).filter(Boolean)),
    );

    productIds.forEach((productId) => {
      if (!serialOptionsByProduct[productId] && !loadingSerialProductIds[productId]) {
        void fetchSerialOptions(productId);
      }
    });
  }, [lines, serialOptionsByProduct, loadingSerialProductIds]);

  useEffect(() => {
    const productId = getSearchString(orderPrefillSearch.product_id);
    const title = getSearchString(orderPrefillSearch.title);
    const serialNumber = getSearchString(orderPrefillSearch.serial_number);
    if (!productId && !title && !serialNumber) return;

    const prefillKey = [productId, title, serialNumber].join("|");
    if (prefillKey === appliedPrefillKey) return;

    const product = products.find((item: any) => String(item.id) === productId);
    setLines([
      {
        product_id: productId,
        title: title || String(product?.title ?? ""),
        serial_number: serialNumber,
        qty: 1,
        price: "",
        custom_inventory: null,
      },
    ]);
    setAppliedPrefillKey(prefillKey);
    if (productId) {
      void fetchSerialOptions(productId, serialNumber);
    }
  }, [appliedPrefillKey, orderPrefillSearch, products]);

  const exportOrdersReport = async () => {
    if (timeRange === "all") {
      toast.error("Select a time range to export");
      return;
    }

    try {
      setIsExporting(true);
      const rows = await exportAdminOrders({
        source: sourceFilter,
        days: Number(timeRange) as 7 | 30 | 90,
      });

      if (rows.length === 0) {
        toast.error("No orders found for that source and time range");
        return;
      }

      const escapedRows = rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.customer_name ?? "Walk-in customer")}</td>
              <td>${escapeHtml(row.customer_phone ?? "")}</td>
              <td>${escapeHtml(formatSource(row.source))}</td>
              <td>${escapeHtml(formatPaymentMethod(row.payment_method))}</td>
              <td>${escapeHtml(formatWarranty(row.warranty))}</td>
              <td>${escapeHtml(
                (row.items ?? [])
                  .map((item: any) => {
                    const serial = String(item.serial_number ?? "").trim();
                    return `${item.title} x${item.qty ?? item.quantity ?? 1}${serial ? ` (SN: ${serial})` : ""}`;
                  })
                  .join(", "),
              )}</td>
              <td>${escapeHtml(formatKES(Number(row.total ?? 0)))}</td>
              <td>${escapeHtml(row.message ?? "")}</td>
              <td>${escapeHtml(new Date(row.created_at).toLocaleDateString())}</td>
              <td>${escapeHtml(new Date(row.created_at).toLocaleTimeString())}</td>
            </tr>`,
        )
        .join("");

      const table = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
          <head>
            <meta charset="utf-8" />
          </head>
          <body>
            <table>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Payment Method</th>
                <th>Warranty</th>
                <th>Items</th>
                <th>Total</th>
                <th>Notes</th>
                <th>Date</th>
                <th>Time</th>
              </tr>
              ${escapedRows}
            </table>
          </body>
        </html>
      `;

      const blob = new Blob([table], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const sourceSlug = sourceFilter === "all" ? "all-sources" : sourceFilter;
      link.href = url;
      link.download = `orders-${sourceSlug}-${timeRange}days.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Orders export downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export orders");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadReceiptPdf = async (order: any) => {
    try {
      const pdfBlob = await buildStyledReceiptPdf(order);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${String(order.id ?? "order").slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Receipt PDF downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Could not generate receipt PDF");
    }
  };

  const shareReceiptToWhatsApp = (order: any) => {
    try {
      const message = buildReceiptWhatsAppMessage(order);
      const phone = normalizeWhatsAppPhone(order.customer_phone);
      const baseUrl = phone ? `https://wa.me/${phone}` : "https://wa.me/";
      const shareUrl = `${baseUrl}?text=${encodeURIComponent(message)}`;
      openWhatsAppConversation(shareUrl);
    } catch (error) {
      console.error(error);
      toast.error("Could not open WhatsApp share");
    }
  };

  const handleDeleteOrder = (order: any) => {
    if (role !== "super_admin") return;
    const customerLabel = order.customer_name || "this order";
    const confirmed = window.confirm(`Delete ${customerLabel}? This cannot be undone.`);
    if (!confirmed) return;
    removeOrder.mutate(String(order.id));
  };

  return (
    <div className="space-y-4">
      {showCreate ? (
      <>
      <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FFF1F2] text-[#E30613]">
            <Plus className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#111111]">Record Order</h1>
            <p className="text-sm text-[#4B5563]">Only completed orders are recorded here, separate from enquiries.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={form.customer_name}
              onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
              placeholder="Customer name"
              className={inputCls}
            />
            <input
              value={form.customer_phone}
              onChange={(event) => setForm((current) => ({ ...current, customer_phone: event.target.value }))}
              placeholder="Customer phone"
              className={inputCls}
            />
            <select
              value={form.source}
              onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as (typeof SOURCES)[number]["value"] }))}
              className={inputCls}
            >
              {SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
            <select
              value={form.payment_method}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payment_method: event.target.value as (typeof PAYMENT_METHODS)[number]["value"],
                }))
              }
              className={inputCls}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="1"
              value={form.warranty}
              onChange={(event) => setForm((current) => ({ ...current, warranty: event.target.value }))}
              placeholder="Warranty (months)"
              className={inputCls}
            />
          </div>
          <div className="space-y-3 rounded-2xl border border-border p-3">
            <div className="flex justify-end rounded-2xl bg-[#F8FAFC] px-4 py-3">
              <button
                type="button"
                onClick={() => setLines((current) => [...current, createEmptyLine()])}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-[#111111] transition-colors hover:bg-[#F5F5F7]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="rounded-[1.4rem] border border-border bg-white p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(150px,0.8fr)_100px_120px_52px] md:items-start">
                    <div className="relative">
                      <input
                        value={line.title}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    title: event.target.value,
                                    product_id: "",
                                    custom_inventory: null,
                                  }
                                : entry,
                            ),
                          )
                        }
                        onFocus={() => setActiveProductSearchIndex(index)}
                        onBlur={() => setActiveProductSearchIndex((current) => (current === index ? null : current))}
                        placeholder="Start typing product name"
                        className={inputCls}
                      />

                      {activeProductSearchIndex === index && line.title.trim().length > 0 && !line.product_id && (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-56 overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-[0_18px_45px_rgba(17,17,17,0.12)]">
                          {getOrderProductSuggestions(line.title, products, inventoryProducts, catalogueProducts)
                            .slice(0, 10)
                            .map((product) => (
                              <button
                                key={`${product.source}-${product.id}`}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setActiveProductSearchIndex(null);
                                  void selectOrderProduct(index, product);
                                }}
                                className="flex w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#F5F5F7]"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-[#111111]">{product.title}</span>
                                  <span
                                    className={cn(
                                      "text-[11px] font-medium",
                                      product.source === "inventory" ? "text-[#E30613]" : "text-[#4B5563]",
                                    )}
                                  >
                                    {product.source === "inventory"
                                      ? `Inventory product${product.serialCount ? ` - ${product.serialCount} serials` : ""}`
                                      : product.source === "catalogue"
                                        ? "Listed product"
                                        : "Catalogue product"}
                                  </span>
                                </span>
                              </button>
                            ))}

                          <button
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              openCustomProductDialog(index);
                            }}
                            className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-[#F6C9CD] px-3 py-2 text-left text-sm font-medium text-[#E30613] transition-colors hover:bg-[#FFF1F2]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Use custom product
                          </button>
                        </div>
                      )}
                    </div>

                    {line.product_id && (serialOptionsByProduct[line.product_id]?.length ?? 0) > 0 ? (
                      <select
                        value={line.serial_number}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, serial_number: event.target.value } : entry,
                            ),
                          )
                        }
                        className={inputCls}
                      >
                        <option value="">Select serial number</option>
                        {serialOptionsByProduct[line.product_id].map((serial) => (
                          <option key={serial.serial_code} value={serial.serial_code}>
                            {serial.serial_code}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={line.custom_inventory ? line.serial_number : ""}
                        readOnly
                        disabled
                        placeholder={
                          line.custom_inventory
                            ? "Custom stock serial"
                            : line.product_id && loadingSerialProductIds[line.product_id]
                            ? "Loading serials..."
                            : line.product_id
                              ? "No available serials"
                              : "Inventory serial only"
                        }
                        className={`${inputCls} bg-[#F8FAFC] text-muted-foreground`}
                      />
                    )}

                    <input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, qty: Math.max(1, Number(event.target.value) || 1) } : entry,
                          ),
                        )
                      }
                      placeholder="Qty"
                      className={inputCls}
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.price}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, price: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Price"
                      className={inputCls}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) => (current.length === 1 ? [createEmptyLine()] : current.filter((_, entryIndex) => entryIndex !== index)))
                      }
                      className="inline-flex h-11 w-[52px] items-center justify-center rounded-xl text-[#4B5563] transition-colors hover:bg-[#F5F5F7]"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-[#F6C9CD] bg-[linear-gradient(135deg,#FFF5F6_0%,#FFFFFF_100%)] px-5 py-4">
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Calculated total</p>
                <p className="mt-1 text-3xl font-bold text-[#111111]">{formatKES(orderTotal)}</p>
              </div>
            </div>
          </div>
          <textarea
            value={form.message}
            onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            placeholder="Notes"
            rows={3}
            className={`${inputCls} resize-none rounded-xl`}
          />
          <button
            type="button"
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending}
            className="w-full rounded-xl bg-[#E30613] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c70511] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createOrder.isPending ? "Saving..." : "Save order"}
          </button>
        </div>
      </section>
      <Dialog open={customProduct.lineIndex != null} onOpenChange={(open) => !open && closeCustomProductDialog()}>
        <DialogContent className="w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Custom product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Product name">
              <input
                value={customProduct.product_name}
                onChange={(event) => setCustomProduct((current) => ({ ...current, product_name: event.target.value }))}
                className={inputCls}
                placeholder="Product name"
                autoFocus
              />
            </Field>
            <Field label="Supplier">
              <select
                value={customProduct.supplier_id}
                onChange={(event) => setCustomProduct((current) => ({ ...current, supplier_id: event.target.value }))}
                className={inputCls}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Serial code">
              <input
                value={customProduct.serial_code}
                onChange={(event) => setCustomProduct((current) => ({ ...current, serial_code: event.target.value }))}
                className={inputCls}
                placeholder="Serial code"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeCustomProductDialog}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-[#4B5563] transition-colors hover:bg-[#F5F5F7]"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomProductDetails}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#E30613] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#c70511]"
              >
                <Plus className="h-4 w-4" />
                Save product
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </>
      ) : null}

      {showList ? (
      <header className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#111111]">Orders</h2>
            <p className="mt-1 text-sm text-[#4B5563]">
              {filtered.length.toLocaleString()} matching orders out of {orders.length.toLocaleString()} total
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_170px_170px_170px] xl:grid-cols-[minmax(220px,1fr)_170px_170px_170px_140px]">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-[#F5F5F7] px-3 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search order no, customer, phone, item"
                className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-muted-foreground"
              />
            </label>

            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value as "all" | (typeof SOURCES)[number]["value"]);
                setPage(1);
              }}
              className={filterCls}
            >
              <option value="all">All sources</option>
              {SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>

            <select
              value={timeRange}
              onChange={(event) => {
                setTimeRange(event.target.value as (typeof TIME_RANGES)[number]["value"]);
                setPage(1);
              }}
              className={filterCls}
            >
              {TIME_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as (typeof SORTS)[number]["value"])}
              className={filterCls}
            >
              {SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={exportOrdersReport}
              disabled={isExporting}
              className="rounded-xl bg-[#E30613] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c70511] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>
      </header>
      ) : null}

      {showList ? (
      <section className="overflow-hidden rounded-[1.5rem] border border-border bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-sm">
            <thead className="bg-[#FAFAFA]">
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order: any) => (
                <tr key={order.id} className="border-b border-border/70 align-top transition-colors hover:bg-[#FAFAFA]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[#111111]">{order.customer_name || "Walk-in customer"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{order.customer_phone || "-"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">
                        {formatSource(order.source)}
                      </span>
                      <span className="inline-flex rounded-full bg-[#FFF1F2] px-2.5 py-1 text-[11px] font-semibold text-[#E30613]">
                        {formatPaymentMethod(order.payment_method)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-[460px] space-y-1 text-xs leading-snug text-[#4B5563]">
                      {(order.items || []).map((item: any, index: number) => (
                        <div key={index} className="whitespace-normal break-words">
                          <span className="font-medium text-[#111111]">{item.title}</span> x{item.qty ?? item.quantity ?? 1}
                          {item.serial_number ? <span className="text-muted-foreground"> SN: {item.serial_number}</span> : null}
                        </div>
                      ))}
                      {(order.items || []).length === 0 && <div className="text-muted-foreground">No items listed</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#111111]">{formatKES(Number(order.total))}</td>
                  <td className="px-4 py-4 text-xs text-[#4B5563]">
                    {new Date(order.created_at).toLocaleDateString()} <br />
                    <span className="text-muted-foreground">{new Date(order.created_at).toLocaleTimeString()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => downloadReceiptPdf(order)}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-[#111111] transition-colors hover:bg-[#F5F5F7]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Receipt PDF
                      </button>
                      {role === "super_admin" ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          disabled={removeOrder.isPending}
                          className="inline-flex h-9 w-9 items-center justify-center text-[#111111] transition-colors hover:text-[#E30613] disabled:cursor-not-allowed disabled:opacity-70"
                          aria-label="Delete order"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No orders match the current search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {showList ? (
      <footer className="flex flex-col gap-3 rounded-[1.5rem] border border-border bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#4B5563]">
          Showing {pageStart} to {pageEnd} of {filtered.length.toLocaleString()} matching orders
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-[#111111] transition-colors hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          {buildPages(currentPage, totalPages).map((value, index) =>
            value === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                className={cn(
                  "min-w-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  currentPage === value
                    ? "border-[#E30613] bg-[#E30613] text-white"
                    : "border-border bg-white text-[#111111] hover:bg-[#F5F5F7]",
                )}
              >
                {value}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-[#111111] transition-colors hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </footer>
      ) : null}
    </div>
  );
}

function AdminOrders() {
  return <AdminOrdersPage />;
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
const filterCls = "rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-[#111111] outline-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSource(value: string) {
  if (value === "walkin") return "Walk-in";
  if (value === "delivery") return "Delivery";
  if (value === "tiktok") return "TikTok";
  if (value === "referall") return "Referall";
  return capitalize(value);
}

function buildPages(currentPage: number, totalPages: number) {
  const pages: Array<number | "ellipsis"> = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const nearCurrent = Math.abs(page - currentPage) <= 1;
    const edge = page === 1 || page === totalPages;
    if (nearCurrent || edge) {
      pages.push(page);
      continue;
    }

    const previous = pages[pages.length - 1];
    if (previous !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return pages;
}

function createEmptyLine(): OrderLine {
  return {
    product_id: "",
    title: "",
    serial_number: "",
    qty: 1,
    price: "",
    custom_inventory: null,
  };
}

function getSearchString(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function withSelectedSerialOption(
  options: Array<{ serial_code: string; received_at: string; stock_status: string }>,
  selectedSerial: string,
) {
  const serial = selectedSerial.trim();
  if (!serial) return options;
  if (options.some((option) => option.serial_code === serial)) return options;

  return [
    {
      serial_code: serial,
      received_at: new Date().toISOString().slice(0, 10),
      stock_status: "taken_out",
    },
    ...options,
  ];
}

type OrderProductSuggestion = {
  id: string;
  title: string;
  source: "inventory" | "catalog" | "catalogue";
  serialCount?: number;
  catalogueId?: string | null;
};

function buildInventoryProductOptions(intakeRecords: any[], products: any[]): OrderProductSuggestion[] {
  const productsById = new Map(products.map((product: any) => [String(product.id), product]));
  const grouped = new Map<string, OrderProductSuggestion>();

  intakeRecords.forEach((record: any) => {
    const id = String(record.product_id ?? "").trim();
    const title = String(record.product_title ?? "").trim();
    if (!id || !title) return;

    const product = productsById.get(id);
    const current = grouped.get(id);
    grouped.set(id, {
      id,
      title,
      source: "inventory",
      serialCount: (current?.serialCount ?? 0) + 1,
    });
  });

  return Array.from(grouped.values()).sort((left, right) => left.title.localeCompare(right.title));
}

function getOrderProductSuggestions(
  query: string,
  products: any[],
  inventoryProducts: OrderProductSuggestion[],
  catalogueProducts: any[],
): OrderProductSuggestion[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const matches = (title: string) => title.toLowerCase().includes(normalizedQuery);
  const suggestions = new Map<string, OrderProductSuggestion>();

  inventoryProducts
    .filter((product) => matches(product.title))
    .forEach((product) => suggestions.set(product.id, product));

  catalogueProducts
    .filter((product: any) => matches(String(product.product_name ?? product.title ?? "")))
    .forEach((product: any) => {
      const id = String(product.product_id ?? product.id ?? "");
      const catalogueId = String(product.id ?? "");
      const title = String(product.product_name ?? product.title ?? "Product").trim();
      if (!id || !title || suggestions.has(id)) return;
      suggestions.set(id, {
        id,
        title,
        source: "catalogue",
        catalogueId,
      });
    });

  products
    .filter((product: any) => matches(String(product.title ?? "")))
    .forEach((product: any) => {
      const id = String(product.id ?? "");
      if (!id || suggestions.has(id)) return;
      suggestions.set(id, {
        id,
        title: String(product.title ?? "Product"),
        source: "catalog",
      });
    });

  return Array.from(suggestions.values());
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReceiptWhatsAppMessage(order: any) {
  const receipt = normalizeReceiptOrder(order);
  const items = receipt.items;
  const itemLines = items.length
    ? items
        .map((item, index) => {
          const serial = item.serialNumber ? `\n   SN: ${item.serialNumber}` : "";
          return `${index + 1}. ${item.title} x${item.quantity}${serial} - ${formatKES(item.total)}`;
        })
        .join("\n")
    : "No items listed";

  return [
    "*Shop ICT Gadgets Receipt*",
    `Receipt No: ${receipt.receiptNumber}`,
    `Date: ${receipt.dateLabel}`,
    `Customer: ${receipt.customerName}`,
    `Source: ${receipt.sourceLabel}`,
    `Payment Method: ${receipt.paymentMethodLabel}`,
    receipt.warrantyLabel ? `Warranty: ${receipt.warrantyLabel}` : "",
    "",
    itemLines,
    "",
    `*Total: ${receipt.totalLabel}*`,
    receipt.notes ? `Notes: ${receipt.notes}` : "",
    "Thank you for shopping with us.",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeWhatsAppPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  return digits;
}

function formatPaymentMethod(value: string | null | undefined) {
  if (value === "im_bank") return "I&M Bank";
  if (value === "family_bank") return "Family Bank";
  if (value === "stanbic_bank") return "Stanbic Bank";
  if (value === "mpesa") return "M-Pesa";
  if (value === "bank_transfer") return "Bank Transfer";
  return "Cash";
}

function formatOrderNumber(value: string | null | undefined) {
  return String(value ?? "ORDER").slice(0, 8).toUpperCase();
}

function normalizeWarrantyMonths(value: string | null | undefined) {
  const digitsOnly = String(value ?? "").trim();
  if (!digitsOnly) return null;
  const months = Math.max(0, Math.floor(Number(digitsOnly) || 0));
  return months > 0 ? String(months) : null;
}

function formatWarranty(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const months = Number(raw);
  if (Number.isFinite(months) && months > 0) {
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  return raw;
}

function sanitizePdfText(value: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

type ReceiptItem = {
  title: string;
  serialNumber: string;
  quantity: number;
  price: number;
  total: number;
};

type ReceiptData = {
  receiptNumber: string;
  dateLabel: string;
  customerName: string;
  phone: string;
  email: string;
  sourceLabel: string;
  paymentMethodLabel: string;
  warrantyLabel: string;
  totalLabel: string;
  total: number;
  notes: string;
  items: ReceiptItem[];
};

const RECEIPT_BRAND = {
  primary: "#E30613",
  accent: "#000052",
  secondary: "#D9E6D6",
  dark: "#111111",
  ink: "#1F2937",
  muted: "#374151",
  line: "#D9E6D6",
  white: "#FFFFFF",
};

function normalizeReceiptOrder(order: any): ReceiptData {
  const createdAt = new Date(order.created_at);
  const items = (Array.isArray(order.items) ? order.items : []).map((item: any) => {
    const quantity = Math.max(1, Number(item?.qty ?? item?.quantity ?? 1) || 1);
    const price = Math.max(0, Number(item?.price ?? 0) || 0);
    return {
      title: String(item?.title ?? "Item"),
      serialNumber: String(item?.serial_number ?? item?.serialNumber ?? "").trim(),
      quantity,
      price,
      total: quantity * price,
    } satisfies ReceiptItem;
  });

  return {
    receiptNumber: formatOrderNumber(order.id),
    dateLabel: `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString()}`,
    customerName: order.customer_name || "Walk-in customer",
    phone: order.customer_phone || "-",
    email: "",
    sourceLabel: formatSource(String(order.source ?? "walkin")),
    paymentMethodLabel: formatPaymentMethod(String(order.payment_method ?? "cash")),
    warrantyLabel: formatWarranty(order.warranty),
    totalLabel: formatKES(Number(order.total ?? 0)),
    total: Number(order.total ?? 0),
    notes: String(order.message ?? "").trim(),
    items,
  };
}

async function buildStyledReceiptPdf(order: any) {
  const receipt = normalizeReceiptOrder(order);
  const canvas = await renderReceiptCanvas(receipt);
  return buildPdfFromCanvas(canvas);
}

async function renderReceiptCanvas(receipt: ReceiptData) {
  const width = 1080;
  const height = 1800;
  const sidePadding = 90;
  const contentWidth = width - sidePadding * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create receipt canvas");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.textBaseline = "top";
  context.fillStyle = RECEIPT_BRAND.white;
  context.fillRect(0, 0, width, height);

  const titleTop = 70;
  const titleFont = `300 72px "Avenir Next", "Montserrat", "Poppins", Arial, sans-serif`;
  drawLetterSpacedText(context, "RECEIPT", sidePadding, titleTop, 6, titleFont, RECEIPT_BRAND.primary);

  const circleSize = 90;
  const circleX = width - sidePadding - circleSize;
  const circleY = 72;
  drawCircle(context, circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2, hexToRgba(RECEIPT_BRAND.secondary, 0.15));
  const logo = await loadReceiptLogo();
  if (logo) {
    drawContainedImage(context, logo, circleX + 8, circleY + 8, circleSize - 16, circleSize - 16);
  } else {
    drawCenteredText(context, "LOGO", circleX + circleSize / 2, circleY + 36, `500 16px "Avenir Next", Arial, sans-serif`, RECEIPT_BRAND.primary);
  }

  const infoBarY = titleTop + 72 + 45;
  context.fillStyle = RECEIPT_BRAND.accent;
  context.fillRect(sidePadding, infoBarY, contentWidth, 28);
  context.font = `600 14px "Avenir Next", "Montserrat", Arial, sans-serif`;
  context.fillStyle = RECEIPT_BRAND.white;
  drawLetterSpacedText(context, `ORDER NO. ${receipt.receiptNumber}`, sidePadding + 12, infoBarY + 7, 1.5, context.font, RECEIPT_BRAND.white);
  drawRightAlignedText(
    context,
    `DATE: ${formatReceiptDate(receipt.dateLabel)}`,
    width - sidePadding - 12,
    infoBarY + 7,
    context.font,
    RECEIPT_BRAND.white,
  );

  const detailsTop = infoBarY + 28 + 40;
  const columnGap = 50;
  const columnWidth = (contentWidth - columnGap * 2) / 3;
  const companyLines = [
    "Online Store",
    "Nairobi, Kenya",
    "Phone: +254 713 869 018",
    "Email: ictgadgetsshop@gmail.com",
    "Website: shopictgadgets.co.ke",
  ];
  const billedLines = [
    receipt.customerName,
    `Phone: ${receipt.phone === "-" ? "" : receipt.phone}`,
    `Email: ${receipt.email}`,
  ];
  const paymentLines = buildPaymentMethodLines(receipt.paymentMethodLabel, receipt.warrantyLabel);

  drawDetailsColumn(context, sidePadding, detailsTop, columnWidth, "SHOP ICT GADGETS", companyLines);
  drawDetailsColumn(context, sidePadding + columnWidth + columnGap, detailsTop, columnWidth, "BILLED TO", billedLines);
  drawDetailsColumn(context, sidePadding + (columnWidth + columnGap) * 2, detailsTop, columnWidth, "PAYMENT METHOD", paymentLines);

  const detailsHeight = 18 + 18 + 28 * 5;
  const tableDividerY = detailsTop + detailsHeight + 55;
  context.fillStyle = hexToRgba(RECEIPT_BRAND.secondary, 0.3);
  context.fillRect(sidePadding, tableDividerY, contentWidth, 2);

  const tableHeaderTop = tableDividerY + 20;
  const columnFractions = [0.08, 0.42, 0.15, 0.17, 0.18];
  const columnWidths = columnFractions.map((value) => value * contentWidth);
  const columnLefts = columnWidths.reduce<number[]>((acc, widthValue, index) => {
    acc.push(index === 0 ? sidePadding : acc[index - 1] + columnWidths[index - 1]);
    return acc;
  }, []);
  const rowCenterOffsets = columnWidths.map((widthValue) => widthValue / 2);
  const headerFont = `700 13px "Avenir Next", "Montserrat", Arial, sans-serif`;
  const rowFont = `400 15px "Avenir Next", "Montserrat", Arial, sans-serif`;

  context.fillStyle = RECEIPT_BRAND.accent;
  context.fillRect(sidePadding, tableHeaderTop, contentWidth, 42);
  const headerY = tableHeaderTop + 13;
  drawCenteredText(context, "NO.", columnLefts[0] + rowCenterOffsets[0], headerY, headerFont, RECEIPT_BRAND.white, 2);
  drawLetterSpacedText(context, "PRODUCT/SERVICE", columnLefts[1] + 18, headerY, 2, headerFont, RECEIPT_BRAND.white);
  drawCenteredText(context, "QUANTITY", columnLefts[2] + rowCenterOffsets[2], headerY, headerFont, RECEIPT_BRAND.white, 2);
  drawCenteredText(context, "UNIT PRICE", columnLefts[3] + rowCenterOffsets[3], headerY, headerFont, RECEIPT_BRAND.white, 2);
  drawCenteredText(context, "TOTAL", columnLefts[4] + rowCenterOffsets[4], headerY, headerFont, RECEIPT_BRAND.white, 2);
  context.fillStyle = hexToRgba(RECEIPT_BRAND.secondary, 0.3);
  context.fillRect(sidePadding, tableHeaderTop + 42, contentWidth, 2);

  const productColumnX = columnLefts[1] + 18;
  const productColumnWidth = columnWidths[1] - 26;
  const receiptRows = receipt.items.map((item) => {
    const productText = item.serialNumber ? `${item.title} | SN: ${item.serialNumber}` : item.title;
    const lineCount = measureWrappedCanvasLineCount(context, productText, productColumnWidth, rowFont);
    return {
      item,
      productText,
      rowHeight: Math.max(58, lineCount * 20 + 24),
    };
  });
  const minimumRows = 7;
  const tableRows: Array<{ item: ReceiptItem; productText: string; rowHeight: number } | null> = [
    ...receiptRows,
    ...Array.from({ length: Math.max(0, minimumRows - receiptRows.length) }, () => null),
  ];
  let rowTop = tableHeaderTop + 44;
  tableRows.forEach((row, index) => {
    const rowHeight = row?.rowHeight ?? 58;
    const centerY = rowTop + Math.max(18, rowHeight / 2 - 10);
    context.fillStyle = hexToRgba(RECEIPT_BRAND.secondary, index < tableRows.length - 1 ? 0.2 : 0.3);
    context.fillRect(sidePadding, rowTop + rowHeight - 1, contentWidth, 1);

    if (row) {
      const item = row.item;
      drawCenteredText(context, String(index + 1), columnLefts[0] + rowCenterOffsets[0], centerY, rowFont, RECEIPT_BRAND.ink);
      drawWrappedCanvasText(context, {
        text: row.productText,
        x: productColumnX,
        y: rowTop + 16,
        maxWidth: productColumnWidth,
        lineHeight: 20,
        font: rowFont,
        color: RECEIPT_BRAND.ink,
      });
      drawCenteredText(context, String(item.quantity), columnLefts[2] + rowCenterOffsets[2], centerY, rowFont, RECEIPT_BRAND.ink);
      drawCenteredText(context, formatReceiptAmount(item.price), columnLefts[3] + rowCenterOffsets[3], centerY, rowFont, RECEIPT_BRAND.ink);
      drawCenteredText(context, formatReceiptAmount(item.total), columnLefts[4] + rowCenterOffsets[4], centerY, rowFont, RECEIPT_BRAND.ink);
    }

    rowTop += rowHeight;
  });

  const tableBodyHeight = tableRows.reduce((sum, row) => sum + (row?.rowHeight ?? 58), 0);
  const totalsTop = tableHeaderTop + 44 + tableBodyHeight + 45;
  const totalsWidth = 280;
  const totalsLeft = width - sidePadding - totalsWidth;
  const termsLeft = sidePadding;
  const termsWidth = totalsLeft - sidePadding - 54;
  const subtotal = receipt.items.reduce((sum, item) => sum + item.total, 0) || receipt.total;
  const discount = 0;
  const totalsRows = [
    { label: "SUBTOTAL", value: formatReceiptAmount(subtotal) },
    { label: "DISCOUNT (0%)", value: formatReceiptAmount(discount) },
  ];
  const termsLines = [
    "Brand New Products - 1 Year Factory Warranty.",
    "Ex-UK Products - 6 Months Warranty.",
    "Warranty excludes physical damage, liquid damage, broken screens, keyboard damage, and mishandling.",
    "Warranty VOID if sticker/seal is tampered with or removed.",
    "Receipt required for all warranty claims.",
  ];

  context.font = `700 14px "Avenir Next", "Montserrat", Arial, sans-serif`;
  drawLetterSpacedText(context, "TERMS & CONDITIONS", termsLeft, totalsTop, 0.8, context.font, RECEIPT_BRAND.dark);

  let termsCursorY = totalsTop + 28;
  const termsBodyFont = `400 13px "Avenir Next", "Montserrat", Arial, sans-serif`;
  for (const line of termsLines) {
    const lineCount = drawWrappedCanvasText(context, {
      text: line,
      x: termsLeft,
      y: termsCursorY,
      maxWidth: termsWidth,
      lineHeight: 18,
      font: termsBodyFont,
      color: RECEIPT_BRAND.ink,
    });
    termsCursorY += lineCount * 18 + 8;
  }
  const termsBottom = termsCursorY - 8;

  context.font = `500 14px "Avenir Next", "Montserrat", Arial, sans-serif`;
  totalsRows.forEach((row, index) => {
    const y = totalsTop + index * 26;
    drawRightAlignedText(context, row.label, totalsLeft + 160, y, context.font, RECEIPT_BRAND.ink, 1);
    drawRightAlignedText(context, row.value, totalsLeft + totalsWidth, y, context.font, RECEIPT_BRAND.ink);
  });

  const totalBarY = totalsTop + totalsRows.length * 26 + 12;
  context.fillStyle = hexToRgba(RECEIPT_BRAND.primary, 0.18);
  context.fillRect(totalsLeft, totalBarY, totalsWidth, 34);
  context.font = `700 14px "Avenir Next", "Montserrat", Arial, sans-serif`;
  drawRightAlignedText(context, "TOTAL", totalsLeft + 150, totalBarY + 9, context.font, RECEIPT_BRAND.primary, 1);
  drawRightAlignedText(context, formatReceiptAmount(receipt.total), totalsLeft + totalsWidth - 12, totalBarY + 9, context.font, RECEIPT_BRAND.primary);

  const lowerContentBottom = Math.max(totalBarY + 34, termsBottom);
  let thankYouTop = lowerContentBottom + 110;
  if (receipt.notes) {
    const notesTop = lowerContentBottom + 28;
    context.fillStyle = hexToRgba(RECEIPT_BRAND.secondary, 0.12);
    context.fillRect(sidePadding, notesTop, contentWidth, 74);
    context.font = `700 14px "Avenir Next", "Montserrat", Arial, sans-serif`;
    drawLetterSpacedText(context, "NOTES", sidePadding + 12, notesTop + 10, 1, context.font, RECEIPT_BRAND.primary);
    drawWrappedCanvasText(context, {
      text: receipt.notes,
      x: sidePadding + 12,
      y: notesTop + 34,
      maxWidth: contentWidth - 24,
      lineHeight: 18,
      font: `400 13px "Avenir Next", "Montserrat", Arial, sans-serif`,
      color: RECEIPT_BRAND.ink,
      maxLines: 2,
    });
    thankYouTop = Math.max(thankYouTop, notesTop + 74 + 64);
  }

  drawCenteredText(
    context,
    "THANK YOU",
    width / 2,
    thankYouTop,
    `300 42px "Avenir Next", "Montserrat", "Poppins", Arial, sans-serif`,
    RECEIPT_BRAND.primary,
    8,
  );

  return cropCanvasHeight(canvas, Math.min(height, Math.ceil(thankYouTop + 82)));
}

function cropCanvasHeight(canvas: HTMLCanvasElement, targetHeight: number) {
  const height = Math.max(1, Math.min(canvas.height, targetHeight));
  if (height >= canvas.height) return canvas;

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = canvas.width;
  croppedCanvas.height = height;
  const croppedContext = croppedCanvas.getContext("2d");
  if (!croppedContext) return canvas;

  croppedContext.drawImage(canvas, 0, 0, canvas.width, height, 0, 0, canvas.width, height);
  return croppedCanvas;
}

function measureWrappedLines(value: string, maxChars: number) {
  const words = String(value ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  input: {
    text: string;
    x: number;
    y: number;
    maxWidth: number;
    lineHeight: number;
    font: string;
    color: string;
    maxLines?: number;
  },
) {
  context.font = input.font;
  context.fillStyle = input.color;
  const lines = splitCanvasTextLines(context, input.text, input.maxWidth);

  const finalLines = input.maxLines ? lines.slice(0, input.maxLines) : lines;
  if (input.maxLines && lines.length > input.maxLines && finalLines.length > 0) {
    finalLines[finalLines.length - 1] = `${finalLines[finalLines.length - 1].replace(/[.,;:!?-]*$/, "")}...`;
  }

  finalLines.forEach((line, index) => {
    context.fillText(line, input.x, input.y + index * input.lineHeight);
  });

  return finalLines.length;
}

function measureWrappedCanvasLineCount(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
) {
  context.font = font;
  return splitCanvasTextLines(context, text, maxWidth).length || 1;
}

function splitCanvasTextLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  let currentLine = "";

  for (const word of words) {
    const chunks = splitLongCanvasWord(context, word, maxWidth);
    for (const chunk of chunks) {
      const nextLine = currentLine ? `${currentLine} ${chunk}` : chunk;
      if (context.measureText(nextLine).width <= maxWidth) {
        currentLine = nextLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = chunk;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function splitLongCanvasWord(context: CanvasRenderingContext2D, word: string, maxWidth: number) {
  if (context.measureText(word).width <= maxWidth) return [word];

  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    const next = `${current}${char}`;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1.5;
    context.stroke();
  }
}

async function loadReceiptLogo() {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/logo.png";
  });
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  font: string,
  color: string,
  letterSpacing = 0,
) {
  if (letterSpacing <= 0) {
    context.font = font;
    context.fillStyle = color;
    const width = context.measureText(text).width;
    context.fillText(text, centerX - width / 2, y);
    return;
  }

  context.font = font;
  const width = measureLetterSpacedText(context, text, letterSpacing);
  drawLetterSpacedText(context, text, centerX - width / 2, y, letterSpacing, font, color);
}

function drawRightAlignedText(
  context: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  y: number,
  font: string,
  color: string,
  letterSpacing = 0,
) {
  context.font = font;
  const width =
    letterSpacing > 0 ? measureLetterSpacedText(context, text, letterSpacing) : context.measureText(text).width;
  if (letterSpacing > 0) {
    drawLetterSpacedText(context, text, rightX - width, y, letterSpacing, font, color);
  } else {
    context.fillStyle = color;
    context.fillText(text, rightX - width, y);
  }
}

function drawLetterSpacedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  font: string,
  color: string,
) {
  context.font = font;
  context.fillStyle = color;
  let currentX = x;
  Array.from(text).forEach((character, index, characters) => {
    context.fillText(character, currentX, y);
    currentX += context.measureText(character).width;
    if (index < characters.length - 1) currentX += letterSpacing;
  });
}

function measureLetterSpacedText(context: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  return Array.from(text).reduce((total, character, index, characters) => {
    return total + context.measureText(character).width + (index < characters.length - 1 ? letterSpacing : 0);
  }, 0);
}

function buildPaymentMethodLines(paymentMethodLabel: string, warrantyLabel: string) {
  return warrantyLabel ? [paymentMethodLabel, `Warranty: ${warrantyLabel}`] : [paymentMethodLabel];
}

function drawDetailsColumn(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: string[],
) {
  context.font = `700 18px "Avenir Next", "Montserrat", Arial, sans-serif`;
  drawLetterSpacedText(context, title, x, y, 1, context.font, RECEIPT_BRAND.dark);
  context.font = `400 15px "Avenir Next", "Montserrat", Arial, sans-serif`;
  context.fillStyle = RECEIPT_BRAND.ink;
  lines.forEach((line, index) => {
    const text = line || " ";
    context.fillText(text, x, y + 36 + index * 28, width);
  });
}

function formatReceiptAmount(value: number) {
  return formatKES(Number(value ?? 0));
}

function formatReceiptDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function buildPdfFromCanvas(canvas: HTMLCanvasElement) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const usableWidth = pageWidth - margin * 2;
  const slicePixelHeight = Math.floor(((pageHeight - margin * 2) / usableWidth) * canvas.width);
  const imageSlices: Array<{ bytes: Uint8Array; width: number; height: number }> = [];

  for (let offsetY = 0; offsetY < canvas.height; offsetY += slicePixelHeight) {
    const sliceHeight = Math.min(slicePixelHeight, canvas.height - offsetY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    const sliceContext = sliceCanvas.getContext("2d");
    if (!sliceContext) continue;
    sliceContext.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    imageSlices.push({
      bytes: dataUrlToBytes(sliceCanvas.toDataURL("image/jpeg", 0.95)),
      width: canvas.width,
      height: sliceHeight,
    });
  }

  const encoder = new TextEncoder();
  const objects: Array<Uint8Array[] | null> = [null];
  objects[1] = [encoder.encode("<< /Type /Catalog /Pages 2 0 R >>")];

  const pageIds = imageSlices.map((_, index) => 3 + index * 3);
  objects[2] = [
    encoder.encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`),
  ];

  imageSlices.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageWidthOnPage = usableWidth;
    const imageHeightOnPage = (image.height / image.width) * imageWidthOnPage;
    const y = pageHeight - margin - imageHeightOnPage;
    const contentStream = encoder.encode(`q\n${imageWidthOnPage} 0 0 ${imageHeightOnPage} ${margin} ${y} cm\n/Im1 Do\nQ`);

    objects[pageId] = [
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    ];
    objects[contentId] = [
      encoder.encode(`<< /Length ${contentStream.length} >>\nstream\n`),
      contentStream,
      encoder.encode("\nendstream"),
    ];
    objects[imageId] = [
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
      ),
      image.bytes,
      encoder.encode("\nendstream"),
    ];
  });

  let totalLength = encoder.encode("%PDF-1.4\n").length;
  const offsets: number[] = [];
  const objectChunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const parts = objects[objectId];
    if (!parts) continue;
    offsets[objectId] = totalLength;
    objectChunks.push(encoder.encode(`${objectId} 0 obj\n`));
    totalLength += encoder.encode(`${objectId} 0 obj\n`).length;
    parts.forEach((part) => {
      objectChunks.push(part);
      totalLength += part.length;
    });
    objectChunks.push(encoder.encode("\nendobj\n"));
    totalLength += encoder.encode("\nendobj\n").length;
  }

  const xrefOffset = totalLength;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    xref += `${String(offsets[objectId] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  objectChunks.push(encoder.encode(xref));

  return new Blob(objectChunks, { type: "application/pdf" });
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
