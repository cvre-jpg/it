import { createLazyFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Filter, Plus, RotateCcw, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createStockTakeoutBatch,
  createStockIntakeBatch,
  deleteStockIntake,
  createStockReturnBatch,
  listProductSerialOptions,
  listInventoryProducts,
  listResellers,
  listInventoryRecords,
  listSuppliers,
  markStockTakeoutReturned,
  upsertStockCount,
  updateStockIntakeMeta,
} from "@/lib/admin-data";
import { useAuth } from "@/hooks/use-auth";
import { formatKES } from "@/lib/format";

export const Route = createLazyFileRoute("/admin/inventory")({ component: AdminInventory });

const STOCK_STATUS_FILTER_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "takeout", label: "Takeout" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
  { value: "deleted", label: "Deleted" },
];

const INACTIVE_TAKEOUT_ACTIONS_STORAGE_KEY = "shop-ict-inactive-takeout-actions";

function readInactiveTakeoutActionIds() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(INACTIVE_TAKEOUT_ACTIONS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveInactiveTakeoutActionIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INACTIVE_TAKEOUT_ACTIONS_STORAGE_KEY, JSON.stringify(ids));
}

export function AdminInventoryPage() {
  const qc = useQueryClient();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const showCombined = path === "/admin/inventory";
  const showIntake = showCombined || path === "/admin/inventory/stock-intake";
  const showTakeout = showCombined || path === "/admin/inventory/take-out";
  const showReturns = showCombined || path === "/admin/inventory/returns";
  const showRecords = showCombined || path === "/admin/inventory/records";
  const { user } = useAuth();
  const [inventoryView, setInventoryView] = useState("stock-intake");
  const [intake, setIntake] = useState({
    catalogue_id: "",
    product_id: "",
    product_name: "",
    supplier_id: "",
    quantity: "",
    serial_prefix: "",
    serial_code_entry: "",
    serial_code_values: [] as string[],
    unit_cost: "",
    received_at: today(),
    stock_status: "in_stock",
    notes: "",
  });
  const [stockCount, setStockCount] = useState({
    product_id: "",
    count_date: today(),
    counted_quantity: "",
    notes: "",
  });
  const [stockReturn, setStockReturn] = useState({
    product_id: "",
    supplier_id: "",
    quantity: "",
    serial_codes: [] as string[],
    return_date: today(),
    reason: "",
    notes: "",
  });
  const [takeout, setTakeout] = useState({
    product_id: "",
    product_name: "",
    reseller_id: "",
    serial_codes: [] as string[],
    takeout_date: today(),
    notes: "",
  });
  const [intakeSearch, setIntakeSearch] = useState("");
  const [intakeSupplierFilter, setIntakeSupplierFilter] = useState("all");
  const [returnSearch, setReturnSearch] = useState("");
  const [returnSupplierFilter, setReturnSupplierFilter] = useState("all");
  const [returnStatusFilter, setReturnStatusFilter] = useState("all");
  const [takeoutSearch, setTakeoutSearch] = useState("");
  const [takeoutResellerFilter, setTakeoutResellerFilter] = useState("all");
  const [stockSearch, setStockSearch] = useState("");
  const [stockSupplierFilter, setStockSupplierFilter] = useState("all");
  const [stockTimeFilter, setStockTimeFilter] = useState("all");
  const [stockStatusFilters, setStockStatusFilters] = useState<string[]>([]);
  const [stockFilterOpen, setStockFilterOpen] = useState(false);
  const [stockFilterDraft, setStockFilterDraft] = useState({
    supplier: "all",
    period: "all",
    statuses: [] as string[],
  });
  const [takeoutSerialOptions, setTakeoutSerialOptions] = useState<
    Array<{ serial_code: string; received_at: string; stock_status: string }>
  >([]);
  const [inactiveTakeoutActionIds, setInactiveTakeoutActionIds] = useState<string[]>(readInactiveTakeoutActionIds);
  const [activeIntakeBundleKey, setActiveIntakeBundleKey] = useState<string | null>(null);
  const [activeReturnBundleKey, setActiveReturnBundleKey] = useState<string | null>(null);
  const [deletingStockId, setDeletingStockId] = useState<string | null>(null);
  const [intakeSetPrice, setIntakeSetPrice] = useState("");
  const [intakeProductSearchOpen, setIntakeProductSearchOpen] = useState(false);
  const [takeoutProductSearchOpen, setTakeoutProductSearchOpen] = useState(false);

  const { data: inventoryProducts = [] } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => listInventoryProducts(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
  });
  const { data: resellers = [] } = useQuery({
    queryKey: ["resellers"],
    queryFn: () => listResellers(),
  });
  const { data } = useQuery({
    queryKey: ["inventory-records"],
    queryFn: () => listInventoryRecords(),
  });
  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const isSuperAdmin = user?.role === "super_admin";
  const stockProductOptions = useMemo(
    () =>
      inventoryProducts
        .map((product: any) => ({ value: String(product.id), label: String(product.title ?? "") }))
        .filter((product) => product.value && product.label)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [inventoryProducts],
  );

  const intakeSupplierOptions = useMemo(
    () => uniqueOptions(data?.intake ?? [], "supplier_name"),
    [data?.intake],
  );
  const intakeRecords = useMemo(() => {
    return (data?.intake ?? []).filter((record: any) => {
      const matchesSearch = matchesQuery(
        intakeSearch,
        record.product_title,
        record.supplier_name,
        record.serial_code,
        record.created_by_name,
      );
      const matchesSupplier =
        intakeSupplierFilter === "all" || (record.supplier_name ?? "") === intakeSupplierFilter;
      return matchesSearch && matchesSupplier;
    });
  }, [data?.intake, intakeSearch, intakeSupplierFilter]);
  const groupedIntakeRecords = useMemo(() => {
    const grouped = new Map<string, any>();

    intakeRecords.forEach((record: any) => {
      const key = [
        record.product_id,
        record.supplier_id ?? "",
        record.received_at,
        record.created_by_name ?? "",
      ].join("|");

      const current = grouped.get(key) ?? {
        key,
        product_title: record.product_title,
        supplier_name: record.supplier_name,
        quantity: 0,
        received_at: record.received_at,
        created_by_name: record.created_by_name,
        stock_price: record.stock_price,
        due_date: record.due_date,
        records: [] as any[],
        serial_codes: [] as string[],
      };

      current.quantity += Number(record.quantity ?? 0);
      current.records.push(record);
      current.serial_codes.push(record.serial_code);
      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [intakeRecords]);
  const activeIntakeBundle =
    groupedIntakeRecords.find((record: any) => record.key === activeIntakeBundleKey) ?? null;
  const returnSupplierOptions = useMemo(
    () => uniqueOptions(data?.returns ?? [], "supplier_name"),
    [data?.returns],
  );
  const returnProductOptions = useMemo(() => {
    if (!stockReturn.supplier_id) return [];

    const unique = new Map<string, string>();
    (data?.stock ?? [])
      .filter(
        (record: any) =>
          String(record.supplier_id ?? "") === String(stockReturn.supplier_id) &&
          String(record.availability_status ?? "") === "in_stock",
      )
      .forEach((record: any) => {
      if (!record.product_id || !record.product_title) return;
      unique.set(String(record.product_id), String(record.product_title));
    });

    return Array.from(unique.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [data?.stock, stockReturn.supplier_id]);
  const returnSerialOptions = useMemo(() => {
    if (!stockReturn.product_id) return [];

    return (data?.stock ?? [])
      .filter((record: any) => {
        const matchesProduct = String(record.product_id ?? "") === String(stockReturn.product_id);
        const matchesSupplier = String(record.supplier_id ?? "") === String(stockReturn.supplier_id);
        return matchesProduct && matchesSupplier && String(record.availability_status ?? "") === "in_stock";
      })
      .map((record: any) => ({
        serial_code: String(record.serial_code ?? ""),
        received_at: String(record.received_at ?? ""),
        stock_status: String(record.stock_status ?? "in_stock"),
      }))
      .filter((record) => record.serial_code)
      .sort((left, right) => left.serial_code.localeCompare(right.serial_code));
  }, [data?.stock, stockReturn.product_id, stockReturn.supplier_id]);
  const returnRecords = useMemo(() => {
    return (data?.returns ?? []).filter((record: any) => {
      const matchesSearch = matchesQuery(
        returnSearch,
        record.product_title,
        record.supplier_name,
        record.serial_code,
        record.reason,
        record.created_by_name,
      );
      const matchesSupplier =
        returnSupplierFilter === "all" || (record.supplier_name ?? "") === returnSupplierFilter;
      const matchesStatus = returnStatusFilter === "all" || record.status === returnStatusFilter;
      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }, [data?.returns, returnSearch, returnSupplierFilter, returnStatusFilter]);
  const groupedReturnRecords = useMemo(() => {
    const grouped = new Map<string, any>();

    returnRecords.forEach((record: any) => {
      const key = [
        record.product_id,
        record.supplier_id ?? "",
        record.reason,
        record.status,
        record.return_date,
        record.created_by_name ?? "",
      ].join("|");

      const current = grouped.get(key) ?? {
        key,
        product_title: record.product_title,
        supplier_name: record.supplier_name,
        reason: record.reason,
        status: record.status,
        return_date: record.return_date,
        created_by_name: record.created_by_name,
        quantity: 0,
        serial_codes: [] as string[],
        records: [] as any[],
      };

      current.quantity += Number(record.quantity ?? 0);
      current.serial_codes.push(record.serial_code);
      current.records.push(record);
      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [returnRecords]);
  const activeReturnBundle =
    groupedReturnRecords.find((record: any) => record.key === activeReturnBundleKey) ?? null;
  const takeoutRecords = useMemo(() => {
    return (data?.takeouts ?? []).filter((record: any) => {
      const matchesSearch = matchesQuery(
        takeoutSearch,
        record.product_title,
        record.reseller_name,
        record.serial_code,
        record.created_by_name,
      );
      const matchesReseller =
        takeoutResellerFilter === "all" || (record.reseller_name ?? "") === takeoutResellerFilter;
      return matchesSearch && matchesReseller;
    });
  }, [data?.takeouts, takeoutSearch, takeoutResellerFilter]);
  const takeoutResellerOptions = useMemo(
    () => uniqueOptions(data?.takeouts ?? [], "reseller_name"),
    [data?.takeouts],
  );
  const stockSupplierOptions = useMemo(
    () => uniqueOptions(data?.stock ?? [], "supplier_name"),
    [data?.stock],
  );
  const stockRows = useMemo(() => {
    return (data?.stock ?? []).filter((record: any) => {
      const matchesSearch = matchesQuery(
        stockSearch,
        record.product_title,
        record.supplier_name,
        record.serial_code,
        record.availability_status,
        record.order_id,
        record.deleted_by_name,
      );
      if (record.availability_status === "deleted" && !stockSearch.trim()) {
        return stockStatusFilters.includes("deleted");
      }
      const matchesSupplier =
        stockSupplierFilter === "all" || (record.supplier_name ?? "") === stockSupplierFilter;
      const matchesTime = matchesStockTimeFilter(record.received_at, stockTimeFilter);
      const matchesStatus =
        stockStatusFilters.length === 0 || stockStatusFilters.includes(String(record.availability_status ?? "in_stock"));
      return matchesSearch && matchesSupplier && matchesTime && matchesStatus;
    });
  }, [data?.stock, stockSearch, stockSupplierFilter, stockTimeFilter, stockStatusFilters]);
  const activeStockFilterCount =
    (stockSupplierFilter !== "all" ? 1 : 0) +
    (stockTimeFilter !== "all" ? 1 : 0) +
    stockStatusFilters.length;
  const groupedStockRows = useMemo(() => {
    const grouped = new Map<string, any>();

    stockRows.forEach((record: any) => {
      const key = [record.product_id, record.supplier_id ?? ""].join("|");
      const current = grouped.get(key) ?? {
        key,
        product_title: record.product_title,
        supplier_name: record.supplier_name,
        total: 0,
        sold: 0,
        takeout: 0,
        returned: 0,
        remaining: 0,
        serials: [] as any[],
      };

      current.total += 1;
      if (record.availability_status === "sold") current.sold += 1;
      if (record.availability_status === "takeout") current.takeout += 1;
      if (record.availability_status === "returned") current.returned += 1;
      if (record.availability_status === "in_stock") current.remaining += 1;
      current.serials.push(record);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((left: any, right: any) =>
      String(left.product_title).localeCompare(String(right.product_title)),
    );
  }, [stockRows]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["inventory-records"] }),
      qc.invalidateQueries({ queryKey: ["inventory-products"] }),
    ]);
  };

  const disableTakeoutActions = (recordId: string) => {
    setInactiveTakeoutActionIds((current) => {
      const next = current.includes(recordId) ? current : [...current, recordId];
      saveInactiveTakeoutActionIds(next);
      return next;
    });
  };

  const enableTakeoutActions = (recordId: string) => {
    setInactiveTakeoutActionIds((current) => {
      const next = current.filter((id) => id !== recordId);
      saveInactiveTakeoutActionIds(next);
      return next;
    });
  };

  const saveIntake = async () => {
    if (!actor) return;
    const exactProduct = inventoryProducts.find((product: any) => {
      const title = String(product.title ?? "").trim().toLowerCase();
      const inputName = intake.product_name.trim().toLowerCase();
      return title === inputName;
    });
    const looseMatches = inventoryProducts.filter((product: any) =>
      String(product.title ?? "").toLowerCase().includes(intake.product_name.trim().toLowerCase()),
    );
    const matchedProduct =
      inventoryProducts.find((product: any) => String(product.id) === intake.product_id) ??
      exactProduct ??
      (looseMatches.length === 1 ? looseMatches[0] : null);
    const serialCodes = buildPrefixedSerialCodes(intake.serial_prefix, intake.serial_code_values);
    const quantity = serialCodes.length;

    if (!matchedProduct && !intake.product_name.trim()) {
      toast.error("Enter a product name");
      return;
    }

    if (serialCodes.length === 0) {
      toast.error("Add at least one serial code");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Quantity must be a whole number greater than zero");
      return;
    }

    if (serialCodes.length !== quantity) {
      toast.error("Quantity must match the number of comma-separated serial codes");
      return;
    }

    const existingSerials = new Set((data?.stock ?? []).map((record: any) => String(record.serial_code ?? "").toLowerCase()));
    const duplicateSerial = serialCodes.find((serialCode) => existingSerials.has(serialCode.toLowerCase()));
    if (duplicateSerial) {
      toast.error(`Serial number ${duplicateSerial} already exists`);
      return;
    }

    let result;
    try {
      result = await createStockIntakeBatch({
        product_id: matchedProduct?.id,
        catalogue_id: null,
        product_name: intake.product_name.trim(),
        supplier_id: intake.supplier_id || null,
        quantity,
        serial_codes: serialCodes,
        unit_cost: intake.unit_cost ? Number(intake.unit_cost) : null,
        received_at: intake.received_at,
        stock_status: intake.stock_status,
        notes: intake.notes || null,
        actor,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save stock intake";
      toast.error(message);
      return;
    }

    toast.success(`${result.count} stock unit(s) recorded`);
    setIntake({
      product_id: "",
      catalogue_id: "",
      product_name: "",
      supplier_id: "",
      quantity: "",
      serial_prefix: "",
      serial_code_entry: "",
      serial_code_values: [],
      unit_cost: "",
      received_at: today(),
      stock_status: "in_stock",
      notes: "",
    });
    await invalidate();
  };

  const addIntakeSerialCode = () => {
    const nextCode = intake.serial_code_entry.trim();
    if (!nextCode) return;

    const nextSerial = buildPrefixedSerialCode(intake.serial_prefix, nextCode);
    const existingSerials = new Set(buildPrefixedSerialCodes(intake.serial_prefix, intake.serial_code_values));
    if (existingSerials.has(nextSerial)) {
      toast.error("That serial code has already been added");
      return;
    }

    setIntake((current) => ({
      ...current,
      serial_code_entry: "",
      serial_code_values: [...current.serial_code_values, nextCode],
      quantity: String(current.serial_code_values.length + 1),
    }));
  };

  const removeIntakeSerialCode = (code: string) => {
    setIntake((current) => ({
      ...current,
      serial_code_values: current.serial_code_values.filter((item) => item !== code),
      quantity: String(current.serial_code_values.filter((item) => item !== code).length),
    }));
  };

  const openIntakeBundle = (record: any) => {
    setActiveIntakeBundleKey(record.key);
    setIntakeSetPrice(record.stock_price == null ? "" : String(record.stock_price));
  };

  const saveIntakeSetPrice = async () => {
    if (!actor || !activeIntakeBundle) return;
    if (!isSuperAdmin) {
      toast.error("Only super admin can set prices");
      return;
    }
    const ids = activeIntakeBundle.records.map((record: any) => String(record.id)).filter(Boolean);
    if (ids.length === 0) {
      toast.error("No intake records selected");
      return;
    }
    if (!intakeSetPrice.trim()) {
      toast.error("Set price is required");
      return;
    }

    try {
      await updateStockIntakeMeta({
        ids,
        stock_price: Math.max(0, Number(intakeSetPrice) || 0),
        due_date: activeIntakeBundle.due_date ?? null,
        actor,
      });
      toast.success("Set price saved for this intake group");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save set price");
    }
  };

  const saveCount = async () => {
    if (!actor) return;
    if (!stockCount.product_id || stockCount.counted_quantity === "") {
      toast.error("Product and counted quantity are required");
      return;
    }

    await upsertStockCount({
      product_id: stockCount.product_id,
      count_date: stockCount.count_date,
      counted_quantity: Math.max(0, Number(stockCount.counted_quantity)),
      notes: stockCount.notes || null,
      actor,
    });

    toast.success("Daily stock count saved");
    setStockCount({
      product_id: "",
      count_date: today(),
      counted_quantity: "",
      notes: "",
    });
    await invalidate();
  };

  const saveReturn = async () => {
    if (!actor) return;
    const serialCodes = Array.from(new Set(stockReturn.serial_codes.map((value) => value.trim()).filter(Boolean)));
    const quantity = serialCodes.length;

    if (!stockReturn.supplier_id || !stockReturn.product_id || serialCodes.length === 0 || !stockReturn.reason.trim()) {
      toast.error("Supplier, product, serial codes, and reason are required");
      return;
    }

    const result = await createStockReturnBatch({
      product_id: stockReturn.product_id,
      supplier_id: stockReturn.supplier_id || null,
      serial_codes: serialCodes,
      return_date: stockReturn.return_date,
      reason: stockReturn.reason.trim(),
      status: "completed",
      notes: stockReturn.notes || null,
      actor,
    });

    toast.success(`${result.count} return unit(s) recorded`);
    setStockReturn({
      product_id: "",
      supplier_id: "",
      quantity: "",
      serial_codes: [],
      return_date: today(),
      reason: "",
      notes: "",
    });
    await invalidate();
  };

  const loadTakeoutSerials = async (productId: string) => {
    const selectedProduct = inventoryProducts.find((product: any) => String(product.id) === String(productId));
    setTakeout((current) => ({
      ...current,
      product_id: productId,
      product_name: selectedProduct ? String(selectedProduct.title ?? "") : current.product_name,
      serial_codes: [],
    }));
    setTakeoutSerialOptions([]);
    if (!productId) return;

    try {
      const serials = await listProductSerialOptions(productId);
      setTakeoutSerialOptions(serials);
    } catch (error) {
      console.error(error);
      toast.error("Could not load serial numbers");
    }
  };

  const saveTakeout = async () => {
    if (!actor) return;

    if (!takeout.product_id || !takeout.reseller_id || takeout.serial_codes.length === 0) {
      toast.error("Product, reseller, and at least one serial number are required");
      return;
    }

    const result = await createStockTakeoutBatch({
      product_id: takeout.product_id,
      reseller_id: takeout.reseller_id,
      serial_codes: takeout.serial_codes,
      takeout_date: takeout.takeout_date,
      notes: takeout.notes || null,
      actor,
    });

    toast.success(`${result.count} stock unit(s) taken out`);
    setTakeout({
      product_id: "",
      product_name: "",
      reseller_id: "",
      serial_codes: [],
      takeout_date: today(),
      notes: "",
    });
    setTakeoutSerialOptions([]);
    await invalidate();
  };

  const markTakeoutReturned = async (record: any) => {
    if (!actor || !record?.id) return;
    if (isTakeoutClosed(record)) {
      toast.info("This take-out has already been marked sold or returned");
      return;
    }

    disableTakeoutActions(record.id);
    try {
      await markStockTakeoutReturned({
        id: record.id,
        notes: null,
        actor,
      });
      toast.success(`${record.serial_code} is back in shop stock`);
      await invalidate();
      if (takeout.product_id === record.product_id) {
        await loadTakeoutSerials(takeout.product_id);
      }
    } catch (error) {
      console.error(error);
      enableTakeoutActions(record.id);
      toast.error("Could not mark the take-out as returned");
    }
  };

  const removeStockIntakeRecord = async (record: any) => {
    if (!actor || user?.role !== "super_admin") {
      toast.error("Only super admin can delete inventory products");
      return;
    }

    if (record.availability_status !== "in_stock") {
      toast.error("Only products that are still in stock can be deleted");
      return;
    }

    const confirmed = window.confirm(`Delete ${record.product_title} (${record.serial_code}) from inventory?`);
    if (!confirmed) return;

    try {
      setDeletingStockId(record.id);
      await deleteStockIntake({ id: record.id, actor });
      toast.success("Inventory product deleted");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inventory-records"] }),
        qc.invalidateQueries({ queryKey: ["inventory-products"] }),
        qc.invalidateQueries({ queryKey: ["supplier-finance-records"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete inventory product");
    } finally {
      setDeletingStockId(null);
    }
  };

  return (
    <div className="space-y-6">
      {(showCombined || showIntake || showTakeout || showReturns) ? (
        <section className="rounded-2xl border bg-card p-4 shadow-soft">
          <Tabs defaultValue={showTakeout ? "take-out" : showIntake ? "stock-intake" : showReturns ? "returns" : "stock-count"} className="space-y-4">
            {showCombined ? <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-[#F5F5F7] p-1">
              <TabsTrigger value="stock-count" className="rounded-xl">
                Daily Stock
              </TabsTrigger>
              <TabsTrigger value="stock-intake" className="rounded-xl">
                Stock Intake
              </TabsTrigger>
              <TabsTrigger value="take-out" className="rounded-xl">
                Take-out
              </TabsTrigger>
              <TabsTrigger value="returns" className="rounded-xl">
                Returns
              </TabsTrigger>
            </TabsList> : null}

            {showCombined ? <TabsContent value="stock-count" className="mt-0">
              <div className="rounded-2xl border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Daily Stock Taking</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Capture the physical counted quantity for today's audit.
                </p>
                <div className="mt-4 space-y-3">
                  <SelectField
                    label="Product"
                    value={stockCount.product_id}
                    onChange={(value) => setStockCount({ ...stockCount, product_id: value })}
                    options={stockProductOptions}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Count date">
                      <input
                        type="date"
                        value={stockCount.count_date}
                        onChange={(e) => setStockCount({ ...stockCount, count_date: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Counted quantity">
                      <input
                        type="number"
                        min="0"
                        value={stockCount.counted_quantity}
                        onChange={(e) => setStockCount({ ...stockCount, counted_quantity: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea
                      rows={5}
                      value={stockCount.notes}
                      onChange={(e) => setStockCount({ ...stockCount, notes: e.target.value })}
                      className={inputCls}
                      placeholder="Any variance, missing units, or shelf observations"
                    />
                  </Field>
                  <Button variant="outline" className="w-full rounded-full" onClick={saveCount}>
                    Save stock count
                  </Button>
                </div>
              </div>
            </TabsContent> : null}

            {showIntake ? <TabsContent value="stock-intake" className="mt-0">
              <div className="rounded-2xl border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Record Supplier Stock Intake</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Record stock intake with quantity and serial codes entered one by one.
                </p>
                <div className="mt-4 space-y-3">
                  <Field label="Product name">
                    <div className="relative">
                      <input
                        value={intake.product_name}
                        onChange={(e) => setIntake({ ...intake, catalogue_id: "", product_id: "", product_name: e.target.value })}
                        onFocus={() => setIntakeProductSearchOpen(true)}
                        onBlur={() => setIntakeProductSearchOpen(false)}
                        className={inputCls}
                        placeholder="Start typing product name"
                      />
                      {intakeProductSearchOpen && intake.product_name.trim().length > 0 && !intake.product_id ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-56 overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-[0_18px_45px_rgba(17,17,17,0.12)]">
                          {inventoryProducts
                            .filter((product: any) =>
                              String(product.title ?? "")
                                .toLowerCase()
                                .includes(intake.product_name.trim().toLowerCase()),
                            )
                            .slice(0, 8)
                            .map((product: any) => (
                              <button
                                key={product.id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setIntake((current) => ({
                                    ...current,
                                    catalogue_id: "",
                                    product_id: String(product.id),
                                    product_name: String(product.title ?? ""),
                                  }));
                                  setIntakeProductSearchOpen(false);
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#F5F5F7]"
                              >
                                <span className="truncate pr-3 text-sm font-medium text-[#111111]">{product.title}</span>
                                <span className="shrink-0 text-xs font-semibold text-[#4B5563]">
                                  Inventory
                                </span>
                              </button>
                            ))}
                          {inventoryProducts.filter((product: any) =>
                            String(product.title ?? "")
                              .toLowerCase()
                              .includes(intake.product_name.trim().toLowerCase()),
                          ).length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              New inventory-only product will be created
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </Field>
                  <SelectField
                    label="Supplier"
                    value={intake.supplier_id}
                    onChange={(value) => setIntake({ ...intake, supplier_id: value })}
                    options={suppliers.map((supplier: any) => ({ value: supplier.id, label: supplier.name }))}
                    placeholder="No supplier"
                    allowEmpty
                  />
                  <div className="space-y-3 rounded-2xl border border-border bg-[#F8FAFC] p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto] sm:items-end">
                      <Field label="Serial prefix">
                        <input
                          value={intake.serial_prefix}
                          onChange={(e) => setIntake({ ...intake, serial_prefix: e.target.value })}
                          className={inputCls}
                          placeholder="HP840G5-"
                        />
                      </Field>
                      <Field label="Serial code">
                        <input
                          value={intake.serial_code_entry}
                          onChange={(e) => setIntake({ ...intake, serial_code_entry: e.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addIntakeSerialCode();
                            }
                          }}
                          className={inputCls}
                          placeholder="001"
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={addIntakeSerialCode}
                        className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-[#1f2937]"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    <div className="rounded-xl border border-[#d8dee6] bg-white p-3">
                      {intake.serial_code_values.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {intake.serial_code_values.map((code) => (
                            <span
                              key={code}
                              className="inline-flex items-center gap-2 rounded-full border border-[#F6C9CD] bg-[#FFF1F2] px-3 py-1.5 text-xs font-medium text-[#E30613]"
                            >
                              {buildPrefixedSerialCode(intake.serial_prefix, code)}
                              <button
                                type="button"
                                onClick={() => removeIntakeSerialCode(code)}
                                className="rounded-full text-[#E30613] hover:text-[#111827]"
                                aria-label={`Remove serial ${buildPrefixedSerialCode(intake.serial_prefix, code)}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No serial codes added yet.</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add one code at a time. Quantity must match the number of serial codes added.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={intake.quantity}
                        readOnly
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Received date">
                      <input
                        type="date"
                        value={intake.received_at}
                        onChange={(e) => setIntake({ ...intake, received_at: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea
                      rows={3}
                      value={intake.notes}
                      onChange={(e) => setIntake({ ...intake, notes: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Button className="w-full rounded-full" onClick={saveIntake}>
                    Save intake
                  </Button>
                </div>
              </div>
            </TabsContent> : null}

            {showTakeout ? <TabsContent value="take-out" className="mt-0">
              <div className="rounded-2xl border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Record Stock Take-out</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Move available stock to a reseller using one or more serial numbers.
                </p>
                <div className="mt-4 space-y-3">
                  <Field label="Product name">
                    <div className="relative">
                      <input
                        value={takeout.product_name}
                        onChange={(event) => {
                          setTakeout({
                            ...takeout,
                            product_id: "",
                            product_name: event.target.value,
                            serial_codes: [],
                          });
                          setTakeoutSerialOptions([]);
                        }}
                        onFocus={() => setTakeoutProductSearchOpen(true)}
                        onBlur={() => setTakeoutProductSearchOpen(false)}
                        className={inputCls}
                        placeholder="Start typing product name"
                      />
                      {takeoutProductSearchOpen && takeout.product_name.trim().length > 0 && !takeout.product_id ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-56 overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-[0_18px_45px_rgba(17,17,17,0.12)]">
                          {inventoryProducts
                            .filter((product: any) =>
                              String(product.title ?? "")
                                .toLowerCase()
                                .includes(takeout.product_name.trim().toLowerCase()),
                            )
                            .slice(0, 8)
                            .map((product: any) => (
                              <button
                                key={product.id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setTakeoutProductSearchOpen(false);
                                  void loadTakeoutSerials(String(product.id));
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#F5F5F7]"
                              >
                                <span className="truncate pr-3 text-sm font-medium text-[#111111]">{product.title}</span>
                                <span className="shrink-0 text-xs font-semibold text-[#4B5563]">
                                  Inventory
                                </span>
                              </button>
                            ))}
                          {inventoryProducts.filter((product: any) =>
                            String(product.title ?? "")
                              .toLowerCase()
                              .includes(takeout.product_name.trim().toLowerCase()),
                          ).length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No matching inventory product found
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </Field>
                  <SelectField
                    label="Reseller"
                    value={takeout.reseller_id}
                    onChange={(value) => setTakeout({ ...takeout, reseller_id: value })}
                    options={resellers.map((reseller: any) => ({ value: reseller.id, label: reseller.name }))}
                  />
                  <Field label="Serial numbers">
                    <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border bg-background p-2 sm:grid-cols-2">
                      {takeoutSerialOptions.length > 0 ? (
                        takeoutSerialOptions.map((serial) => {
                          const checked = takeout.serial_codes.includes(serial.serial_code);
                          return (
                            <label
                              key={serial.serial_code}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                                checked ? "border-primary bg-primary/5 text-foreground" : "border-transparent hover:bg-[#F5F5F7]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setTakeout((current) => ({
                                    ...current,
                                    serial_codes: event.target.checked
                                      ? [...current.serial_codes, serial.serial_code]
                                      : current.serial_codes.filter((code) => code !== serial.serial_code),
                                  }))
                                }
                                className="h-4 w-4 rounded border-border accent-primary"
                              />
                              <span className="font-mono text-xs">{serial.serial_code}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          Select a product to view available serial numbers.
                        </p>
                      )}
                    </div>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Date">
                      <input
                        type="date"
                        value={takeout.takeout_date}
                        onChange={(e) => setTakeout({ ...takeout, takeout_date: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <DetailItem label="Selected serials" value={String(takeout.serial_codes.length)} />
                  </div>
                  <Field label="Notes">
                    <textarea
                      rows={3}
                      value={takeout.notes}
                      onChange={(e) => setTakeout({ ...takeout, notes: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Button className="w-full rounded-full" onClick={saveTakeout}>
                    Save take-out
                  </Button>
                </div>
              </div>
            </TabsContent> : null}

            {showReturns ? <TabsContent value="returns" className="mt-0">
              <div className="rounded-2xl border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Record Returns</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track supplier returns using products already captured in stock intake.
                </p>
                <div className="mt-4 space-y-3">
                  <SelectField
                    label="Supplier"
                    value={stockReturn.supplier_id}
                    onChange={(value) => setStockReturn({ ...stockReturn, supplier_id: value, product_id: "", serial_codes: [], quantity: "" })}
                    options={suppliers.map((supplier: any) => ({ value: supplier.id, label: supplier.name }))}
                  />
                  <SelectField
                    label="Product"
                    value={stockReturn.product_id}
                    onChange={(value) => setStockReturn({ ...stockReturn, product_id: value, serial_codes: [], quantity: "" })}
                    options={returnProductOptions}
                    placeholder={stockReturn.supplier_id ? "Select product" : "Select supplier first"}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={stockReturn.serial_codes.length}
                        readOnly
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Return date">
                      <input
                        type="date"
                        value={stockReturn.return_date}
                        onChange={(e) => setStockReturn({ ...stockReturn, return_date: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Serial codes">
                    <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border bg-background p-2 sm:grid-cols-2">
                      {returnSerialOptions.length > 0 ? (
                        returnSerialOptions.map((serial) => {
                          const checked = stockReturn.serial_codes.includes(serial.serial_code);
                          return (
                            <label
                              key={serial.serial_code}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                                checked ? "border-primary bg-primary/5 text-foreground" : "border-transparent hover:bg-[#F5F5F7]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setStockReturn((current) => {
                                    const serialCodes = event.target.checked
                                      ? [...current.serial_codes, serial.serial_code]
                                      : current.serial_codes.filter((code) => code !== serial.serial_code);
                                    return {
                                      ...current,
                                      serial_codes: serialCodes,
                                      quantity: String(serialCodes.length),
                                    };
                                  })
                                }
                                className="h-4 w-4 rounded border-border accent-primary"
                              />
                              <span className="font-mono text-xs">{serial.serial_code}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          Select a supplier and product to view available serial numbers.
                        </p>
                      )}
                    </div>
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Select the serial numbers that have been returned.
                  </p>
                  <Field label="Reason">
                    <input
                      value={stockReturn.reason}
                      onChange={(e) => setStockReturn({ ...stockReturn, reason: e.target.value })}
                      className={inputCls}
                      placeholder="Faulty device / wrong item / supplier recall"
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      rows={3}
                      value={stockReturn.notes}
                      onChange={(e) => setStockReturn({ ...stockReturn, notes: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Button variant="secondary" className="w-full rounded-full" onClick={saveReturn}>
                    Save return
                  </Button>
                </div>
              </div>
            </TabsContent> : null}
          </Tabs>
        </section>
      ) : null}

      {showRecords ? <section className="rounded-2xl border bg-card shadow-soft">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {inventoryView === "in-stock"
                  ? "In-stock"
                  : inventoryView === "stock-intake"
                    ? "Stock Intake"
                    : inventoryView === "take-outs"
                      ? "Take-outs"
                      : "Returns"}
              </h2>
            </div>
            <div className="inline-flex rounded-2xl border bg-[#F5F5F7] p-1">
              {[
                { value: "in-stock", label: "In-stock" },
                { value: "stock-intake", label: "Stock Intake" },
                { value: "take-outs", label: "Take-outs" },
                { value: "returns", label: "Returns" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setInventoryView(tab.value)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    inventoryView === tab.value
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {inventoryView === "in-stock" ? (
          <div className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className={inputCls}
                placeholder="Search product, supplier, serial number, status, or order"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border bg-white px-4"
                onClick={() => {
                  setStockFilterDraft({
                    supplier: stockSupplierFilter,
                    period: stockTimeFilter,
                    statuses: stockStatusFilters,
                  });
                  setStockFilterOpen(true);
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters{activeStockFilterCount > 0 ? ` (${activeStockFilterCount})` : ""}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <StockMetric label="Total stock" value={stockRows.length} />
              <StockMetric label="In stock" value={stockRows.filter((record: any) => record.availability_status === "in_stock").length} />
              <StockMetric label="Takeout" value={stockRows.filter((record: any) => record.availability_status === "takeout").length} />
              <StockMetric label="Returned" value={stockRows.filter((record: any) => record.availability_status === "returned").length} />
              <StockMetric label="Sold" value={stockRows.filter((record: any) => record.availability_status === "sold").length} />
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">In stock</th>
                    <th className="px-4 py-3 font-medium">Takeout</th>
                    <th className="px-4 py-3 font-medium">Sold</th>
                    <th className="px-4 py-3 font-medium">Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedStockRows.length > 0 ? (
                    groupedStockRows.map((record: any) => (
                      <tr key={record.key} className="border-t transition hover:bg-[#FAFAFB]">
                        <td className="px-4 py-3 font-medium text-foreground">{record.product_title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.supplier_name ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.total}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{record.remaining}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.takeout}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.sold}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.returned}</td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow colSpan={7} message="No stock records match the current search and supplier filter." />
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-[1040px] w-full text-sm">
                <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Serial</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Received</th>
                    {isSuperAdmin ? <th className="px-4 py-3 font-medium text-right">Delete</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {stockRows.length > 0 ? (
                    stockRows.map((record: any) => {
                      const canDelete = record.availability_status === "in_stock";
                      const isDeleting = deletingStockId === record.id;
                      return (
                        <tr key={record.id} className="border-t transition hover:bg-[#FAFAFB]">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{record.serial_code}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{record.product_title}</td>
                          <td className="px-4 py-3 text-muted-foreground">{record.supplier_name ?? "-"}</td>
                          <td className="px-4 py-3">
                            <AvailabilityBadge value={record.availability_status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.availability_status === "deleted"
                              ? record.deleted_by_name
                                ? `Deleted by ${record.deleted_by_name}`
                                : "Deleted"
                              : record.order_id
                              ? formatShortId(record.order_id)
                              : record.takeout_reseller_name
                                ? `Reseller: ${record.takeout_reseller_name}`
                                : "-"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(record.received_at)}</td>
                          {isSuperAdmin ? (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeStockIntakeRecord(record)}
                                disabled={!canDelete || isDeleting}
                                title={canDelete ? "Delete inventory product" : "Only in-stock products can be deleted"}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#B91C1C] transition hover:bg-[#FFF1F2] disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
                                aria-label="Delete inventory product"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  ) : (
                    <EmptyTableRow colSpan={isSuperAdmin ? 7 : 6} message="No serial records match the current search." />
                  )}
                </tbody>
              </table>
            </div>

            <Dialog open={stockFilterOpen} onOpenChange={setStockFilterOpen}>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl p-4 sm:max-w-lg sm:p-6">
                <DialogHeader>
                  <DialogTitle>Filter in-stock records</DialogTitle>
                  <DialogDescription>Apply supplier, period, and status filters to inventory records.</DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  <Field label="Supplier">
                    <select
                      value={stockFilterDraft.supplier}
                      onChange={(e) => setStockFilterDraft((current) => ({ ...current, supplier: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="all">All suppliers</option>
                      {stockSupplierOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Period">
                    <select
                      value={stockFilterDraft.period}
                      onChange={(e) => setStockFilterDraft((current) => ({ ...current, period: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="all">All time</option>
                      <option value="today">Today</option>
                      <option value="3">Last 3 days</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="60">Last 60 days</option>
                      <option value="90">Last 90 days</option>
                    </select>
                  </Field>

                  <Field label="Status">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {STOCK_STATUS_FILTER_OPTIONS.map((status) => {
                        const checked = stockFilterDraft.statuses.includes(status.value);
                        return (
                          <label
                            key={status.value}
                            className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setStockFilterDraft((current) => ({
                                  ...current,
                                  statuses: event.target.checked
                                    ? [...current.statuses, status.value]
                                    : current.statuses.filter((item) => item !== status.value),
                                }))
                              }
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                            <span>{status.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setStockSupplierFilter("all");
                      setStockTimeFilter("all");
                      setStockStatusFilters([]);
                      setStockFilterDraft({ supplier: "all", period: "all", statuses: [] });
                      setStockFilterOpen(false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => {
                      setStockSupplierFilter(stockFilterDraft.supplier);
                      setStockTimeFilter(stockFilterDraft.period);
                      setStockStatusFilters(stockFilterDraft.statuses);
                      setStockFilterOpen(false);
                    }}
                  >
                    Apply filters
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

        {inventoryView === "take-outs" ? (
          <div className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px]">
              <input
                value={takeoutSearch}
                onChange={(e) => setTakeoutSearch(e.target.value)}
                className={inputCls}
                placeholder="Search by product, reseller, serial, or staff"
              />
              <select
                value={takeoutResellerFilter}
                onChange={(e) => setTakeoutResellerFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">All resellers</option>
                {takeoutResellerOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Reseller</th>
                    <th className="px-4 py-3 font-medium">Serial</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {takeoutRecords.length > 0 ? (
                    takeoutRecords.map((record: any) => {
                      const takeoutClosed = isTakeoutClosed(record);
                      const takeoutActionsDisabled =
                        takeoutClosed || inactiveTakeoutActionIds.includes(record.id);
                      return (
                      <tr key={record.id} className="border-t transition hover:bg-[#FAFAFB]">
                        <td className="px-4 py-3 font-medium text-foreground">{record.product_title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.reseller_name ?? "-"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{record.serial_code}</td>
                        <td className="px-4 py-3">
                          {record.is_sold ? (
                            <span className="rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#B91C1C]">
                              Sold
                            </span>
                          ) : record.returned_at ? (
                            <span className="rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#15803D]">
                              Returned
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#1D4ED8]">
                              Takeout
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(record.takeout_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.notes ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.created_by_name ?? "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {takeoutActionsDisabled ? (
                              <span
                                aria-disabled="true"
                                className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full border border-border bg-[#F5F5F7] px-3 text-xs font-medium text-muted-foreground opacity-60"
                                title="This take-out is already sold or returned"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                Sold
                              </span>
                            ) : (
                              <a
                                href={buildOrderPrefillHref(record)}
                                onClick={() => disableTakeoutActions(record.id)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-[#111827] transition hover:bg-[#F5F5F7]"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                Sold
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 rounded-full px-3 text-xs"
                              disabled={takeoutActionsDisabled}
                              title={takeoutActionsDisabled ? "This take-out is already sold or returned" : undefined}
                              onClick={() => markTakeoutReturned(record)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Returned
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  ) : (
                    <EmptyTableRow colSpan={8} message="No stock take-out records match the current search." />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {inventoryView === "stock-intake" ? (
          <div className="space-y-4 p-5">
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px]">
                <input
                  value={intakeSearch}
                  onChange={(e) => setIntakeSearch(e.target.value)}
                  className={inputCls}
                  placeholder="Search by product, supplier, serial, or staff"
                />
                <select
                  value={intakeSupplierFilter}
                  onChange={(e) => setIntakeSupplierFilter(e.target.value)}
                  className={inputCls}
                >
                  <option value="all">All suppliers</option>
                  {intakeSupplierOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Received</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedIntakeRecords.length > 0 ? (
                    groupedIntakeRecords.map((record: any) => (
                      <tr key={record.key} className="border-t transition hover:bg-[#FAFAFB]">
                        <td className="px-4 py-3 font-medium text-foreground">{record.product_title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.supplier_name ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(record.received_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.created_by_name ?? "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openIntakeBundle(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4B5563] transition hover:text-[#111827]"
                            aria-label="View stock intake bundle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow
                      colSpan={6}
                      message="No stock intake records match the current search and filters."
                    />
                  )}
                </tbody>
              </table>
            </div>

            <Dialog
              open={Boolean(activeIntakeBundle)}
              onOpenChange={(open) => {
                if (!open) {
                  setActiveIntakeBundleKey(null);
                  setIntakeSetPrice("");
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                {activeIntakeBundle ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>{activeIntakeBundle.product_title}</DialogTitle>
                      <DialogDescription>
                        {activeIntakeBundle.supplier_name ?? "No supplier"} • {formatDate(activeIntakeBundle.received_at)}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailItem label="Quantity" value={String(activeIntakeBundle.quantity)} />
                      <DetailItem label="Received" value={formatDate(activeIntakeBundle.received_at)} />
                      <DetailItem label="Recorded by" value={activeIntakeBundle.created_by_name ?? "-"} />
                      <DetailItem label="Supplier" value={activeIntakeBundle.supplier_name ?? "-"} />
                      <DetailItem
                        label="Set price"
                        value={
                          activeIntakeBundle.stock_price == null
                            ? "-"
                            : formatKES(Number(activeIntakeBundle.stock_price))
                        }
                      />
                    </div>
                    {isSuperAdmin ? (
                      <div className="rounded-2xl border border-[#F6C9CD] bg-[#FFF8F8] p-4">
                        <Field label="Set price (KES)">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={intakeSetPrice}
                              onChange={(event) => setIntakeSetPrice(event.target.value)}
                              className={inputCls}
                              placeholder="Enter set price"
                            />
                            <Button type="button" className="shrink-0 rounded-full" onClick={saveIntakeSetPrice}>
                              Save set price
                            </Button>
                          </div>
                        </Field>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Serial codes</h3>
                      <div className="rounded-xl border border-[#d8dee6] bg-[#F8FAFC] p-4">
                        <p className="font-mono text-xs leading-6 text-[#0F172A]">
                          {activeIntakeBundle.serial_codes.join(", ")}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

        {inventoryView === "returns" ? (
          <div className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_220px]">
              <input
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                className={inputCls}
                placeholder="Search by product, supplier, serial, reason, or staff"
              />
              <select
                value={returnSupplierFilter}
                onChange={(e) => setReturnSupplierFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">All suppliers</option>
                {returnSupplierOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={returnStatusFilter}
                onChange={(e) => setReturnStatusFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">All return status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-[#F5F5F7] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Return Date</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedReturnRecords.length > 0 ? (
                    groupedReturnRecords.map((record: any) => (
                      <tr key={record.key} className="border-t transition hover:bg-[#FAFAFB]">
                        <td className="px-4 py-3 font-medium text-foreground">{record.product_title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.supplier_name ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.reason}</td>
                        <td className="px-4 py-3">
                          <StatusBadge value={record.status} tone="alert" />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(record.return_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.created_by_name ?? "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveReturnBundleKey(record.key)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4B5563] transition hover:text-[#111827]"
                            aria-label="View return bundle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow
                      colSpan={8}
                      message="No return records match the current search and filters."
                    />
                  )}
                </tbody>
              </table>
            </div>

            <Dialog open={Boolean(activeReturnBundle)} onOpenChange={(open) => !open && setActiveReturnBundleKey(null)}>
              <DialogContent className="max-w-2xl">
                {activeReturnBundle ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>{activeReturnBundle.product_title}</DialogTitle>
                      <DialogDescription>
                        {activeReturnBundle.supplier_name ?? "No supplier"} • {formatDate(activeReturnBundle.return_date)}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailItem label="Quantity" value={String(activeReturnBundle.quantity)} />
                      <DetailItem label="Status" value={String(activeReturnBundle.status).replaceAll("_", " ")} />
                      <DetailItem label="Reason" value={activeReturnBundle.reason} />
                      <DetailItem label="Recorded by" value={activeReturnBundle.created_by_name ?? "-"} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Serial codes</h3>
                      <div className="rounded-xl border border-[#d8dee6] bg-[#F8FAFC] p-4">
                        <p className="font-mono text-xs leading-6 text-[#0F172A]">
                          {activeReturnBundle.serial_codes.join(", ")}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        ) : null}
      </section> : null}
    </div>
  );
}

function AdminInventory() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path.startsWith("/admin/inventory/products")) return <Outlet />;
  return <AdminInventoryPage />;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d8dee6] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm text-[#0F172A]">{value}</p>
    </div>
  );
}

function StockMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-white p-4">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold text-[#111827]">{value.toLocaleString()}</p>
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

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select option",
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">{allowEmpty ? "No supplier" : placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

function StatusBadge({
  value,
  tone,
}: {
  value: string;
  tone: "neutral" | "alert";
}) {
  const label = value.replaceAll("_", " ");
  const cls = tone === "alert" ? "bg-[#FFF1F2] text-[#E30613]" : "bg-[#F5F5F7] text-[#4B5563]";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${cls}`}>{label}</span>;
}

function AvailabilityBadge({ value }: { value: string }) {
  const normalized = String(value ?? "in_stock");
  const cls =
    normalized === "sold"
      ? "bg-[#FEF2F2] text-[#B91C1C]"
      : normalized === "takeout"
        ? "bg-[#EFF6FF] text-[#1D4ED8]"
      : normalized === "returned"
        ? "bg-[#FFF7ED] text-[#B45309]"
      : normalized === "deleted"
        ? "bg-[#F3F4F6] text-[#6B7280]"
        : "bg-[#ECFDF3] text-[#15803D]";
  const label =
    normalized === "in_stock"
      ? "In stock"
      : normalized === "takeout"
        ? "Takeout"
        : normalized === "deleted"
          ? "Deleted"
          : normalized;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${cls}`}>
      {label.replaceAll("_", " ")}
    </span>
  );
}

function matchesQuery(query: string, ...values: Array<unknown>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}

function uniqueOptions(records: Array<any>, key: string) {
  return Array.from(
    new Set(
      records
        .map((record) => String(record?.[key] ?? "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function matchesStockTimeFilter(value: string, filter: string) {
  if (filter === "all") return true;

  const recordTime = new Date(value).getTime();
  if (!Number.isFinite(recordTime)) return false;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (filter === "today") {
    return recordTime >= todayStart.getTime();
  }

  const days = Number(filter);
  if (!Number.isFinite(days) || days <= 0) return true;

  const rangeStart = new Date(todayStart);
  rangeStart.setDate(todayStart.getDate() - (days - 1));
  return recordTime >= rangeStart.getTime();
}

function buildPrefixedSerialCode(prefix: string, code: string) {
  return `${String(prefix ?? "").trim()}${String(code ?? "").trim()}`.trim();
}

function buildPrefixedSerialCodes(prefix: string, codes: string[]) {
  return Array.from(
    new Set(
      codes
        .map((code) => buildPrefixedSerialCode(prefix, code))
        .filter(Boolean),
    ),
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortId(value: string) {
  return String(value ?? "").slice(0, 8).toUpperCase();
}

function buildOrderPrefillHref(record: any) {
  const params = new URLSearchParams();
  if (record.product_id) params.set("product_id", String(record.product_id));
  if (record.product_title) params.set("title", String(record.product_title));
  if (record.serial_code) params.set("serial_number", String(record.serial_code));
  return `/admin/orders/create?${params.toString()}`;
}

function isTakeoutClosed(record: any) {
  return Boolean(record?.is_sold || record?.returned_at);
}

const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
