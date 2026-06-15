import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Boxes,
  ChartColumn,
  CircleAlert,
  DollarSign,
  MessageCircleMore,
  Monitor,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminDashboard, listProductCatalogue } from "@/lib/admin-data";
import { useAuth } from "@/hooks/use-auth";
import { formatKES } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const RANGE_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#FFF7ED] text-[#B45309]",
  contacted: "bg-[#EFF6FF] text-[#1D4ED8]",
  completed: "bg-[#ECFDF3] text-[#15803D]",
  cancelled: "bg-[#FEF2F2] text-[#B91C1C]",
};

const TRAFFIC_COLORS = ["#111111", "#E30613", "#6B7280", "#F87171", "#D1D5DB"];

function AdminDashboard() {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["value"]>(30);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchAdminDashboard(),
  });
  const { data: catalogue = [] } = useQuery({
    queryKey: ["product-catalogue"],
    queryFn: () => listProductCatalogue(),
    enabled: role === "attendant",
  });
  const [manualRefreshPending, setManualRefreshPending] = useState(false);
  const refreshDashboard = async () => {
    setManualRefreshPending(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        role === "super_admin"
          ? queryClient.invalidateQueries({ queryKey: ["super-admin-notifications"] })
          : Promise.resolve(),
      ]);
    } finally {
      setManualRefreshPending(false);
    }
  };
  const refreshBusy = manualRefreshPending || isFetching;

  const stats = data?.stats;
  const chartData = useMemo(() => data?.analytics.series.slice(-range) ?? [], [data?.analytics.series, range]);
  const trafficSources = useMemo(
    () =>
      (data?.analytics.trafficSources ?? []).map((source: any, index: number) => ({
        ...source,
        color: TRAFFIC_COLORS[index % TRAFFIC_COLORS.length],
      })),
    [data?.analytics.trafficSources],
  );
  const totalTraffic = useMemo(
    () => trafficSources.reduce((sum: number, source: any) => sum + Number(source.value ?? 0), 0),
    [trafficSources],
  );
  const deviceAnalytics = useMemo(() => data?.analytics.deviceAnalytics ?? [], [data?.analytics.deviceAnalytics]);
  const totalDevices = useMemo(
    () => deviceAnalytics.reduce((sum: number, device: any) => sum + Number(device.users ?? 0), 0),
    [deviceAnalytics],
  );
  const notifications = useMemo(
    () => buildNotifications({
      role,
      pending: stats?.pending ?? 0,
      completed: stats?.completed ?? 0,
      lowStock: data?.products.lowStock.length ?? 0,
      upcomingBills: data?.products.upcomingBills ?? [],
      overdueTakeouts: data?.products.overdueTakeouts ?? [],
      recent: data?.recent ?? [],
    }),
    [
      data?.products.lowStock.length,
      data?.products.overdueTakeouts,
      data?.products.upcomingBills,
      data?.recent,
      role,
      stats?.completed,
      stats?.pending,
    ],
  );

  const topCards = [
    {
      label: "Total Products",
      value: formatNumber(stats?.products ?? 0),
      trend: "+8.4%",
      icon: Package,
      spark: buildSparkData(stats?.products ?? 0, 4),
    },
    {
      label: "Total Orders",
      value: formatNumber(stats?.orders ?? 0),
      trend: "+12.6%",
      icon: ShoppingBag,
      spark: buildSparkData(stats?.orders ?? 0, 6),
    },
    {
      label: "WhatsApp Inquiries",
      value: formatNumber(stats?.inquiries ?? 0),
      trend: "+15.2%",
      icon: MessageCircleMore,
      spark: buildSparkData(stats?.inquiries ?? 0, 7),
    },
    {
      label: "Estimated Revenue",
      value: formatKES(stats?.revenue ?? 0),
      trend: "+10.9%",
      icon: DollarSign,
      spark: buildSparkData(Math.round((stats?.revenue ?? 0) / 1000), 9),
    },
    {
      label: "Monthly Expenses",
      value: formatKES(stats?.monthlyExpenses ?? 0),
      trend: "Tracked",
      icon: ChartColumn,
      spark: buildSparkData(Math.round((stats?.monthlyExpenses ?? 0) / 1000), 5),
    },
  ];

  const rightMetrics = [
    { label: "Conversion Rate", value: `${stats?.conversionRate ?? 0}%`, caption: "Inquiry to completed order" },
    { label: "Total Customers", value: formatNumber(stats?.customers ?? 0), caption: "Unique shoppers captured" },
    {
      label: "Returning Customers",
      value: formatNumber(stats?.returningCustomers ?? 0),
      caption: "Customers with repeat orders",
    },
    { label: "Average Order Value", value: formatKES(stats?.averageOrderValue ?? 0), caption: "Average cart estimate" },
  ];
  const catalogueMatches = useMemo(() => {
    const query = catalogueSearch.trim().toLowerCase();
    if (query.length < 2) return [];

    return catalogue
      .filter((entry) =>
        [entry.product_name, entry.title, entry.item, ...Object.values(entry.specs ?? {})]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [catalogue, catalogueSearch]);

  if (role === "attendant") {
    return (
      <div className="grid max-w-5xl gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#111111]">Catalogue Search</h3>
            <Search className="h-4 w-4 text-[#E30613]" />
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={catalogueSearch}
              onChange={(event) => setCatalogueSearch(event.target.value)}
              className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search catalogue before listing"
            />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border">
            {catalogueSearch.trim().length < 2 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Type at least 2 letters to check existing catalogue products.</div>
            ) : catalogueMatches.length > 0 ? (
              <div className="divide-y">
                {catalogueMatches.map((entry) => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111111]">{entry.product_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.item || "Catalogue"} - {entry.product_id ? "Listed on website" : "Not listed on website"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground">No matching catalogue product found.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#111111]">Quick Actions</h3>
            <Plus className="h-4 w-4 text-[#E30613]" />
          </div>
          <div className="mt-4 grid gap-2.5">
            <QuickAction label="Add Product" icon={Package} to="/admin/products/add" primary />
            <QuickAction label="Products List" icon={ShoppingBag} to="/admin/products/list" />
            <QuickAction label="Add Catalogue" icon={Boxes} to="/admin/catalogue/add" />
            <QuickAction label="Catalogue List" icon={Monitor} to="/admin/catalogue/list" />
          </div>
        </section>
      </div>
    );
  }

  if (role === "admin") {
    return (
      <div className="w-full max-w-[360px] space-y-4">
        <DashboardRefreshButton onRefresh={refreshDashboard} busy={refreshBusy} />
        <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#111111]">Quick Actions</h3>
            <Plus className="h-4 w-4 text-[#E30613]" />
          </div>
          <div className="mt-4 grid gap-2.5">
            <QuickAction label="New Order" icon={ShoppingBag} to="/admin/orders/create" primary />
            <QuickAction label="Inventory Products" icon={Package} to="/admin/inventory/products" />
            <QuickAction label="Stock Intake" icon={Boxes} to="/admin/inventory/stock-intake" />
            <QuickAction label="Take-out Stock" icon={ArrowRight} to="/admin/inventory/take-out" />
            <QuickAction label="Returns" icon={ArrowRight} to="/admin/inventory/returns" />
            <QuickAction label="Inventory Records" icon={Monitor} to="/admin/inventory/records" />
            <QuickAction label="Record Expense" icon={ChartColumn} to="/admin/expenses" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      <div className="flex justify-end">
        <DashboardRefreshButton onRefresh={refreshDashboard} busy={refreshBusy} />
      </div>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-5">
        {topCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,320px)]">
        <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">Sales &amp; Inquiry Analytics</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Track order momentum, revenue movement, and inquiry volume trends.</p>
            </div>

            <div className="inline-flex rounded-xl border border-border bg-[#F5F5F7] p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    range === option.value ? "bg-white text-[#111111] shadow-sm" : "text-[#4B5563] hover:text-[#111111]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "#E30613" },
                inquiries: { label: "Inquiries", color: "#9CA3AF" },
              }}
              className="h-[260px] w-full"
            >
              <LineChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-semibold text-[#111111]">
                            {name === "Revenue" ? formatKES(Number(value)) : Number(value).toLocaleString()}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "#E30613" }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="inquiries"
                  stroke="var(--color-inquiries)"
                  strokeWidth={2.25}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {rightMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-[1.25rem] border border-border bg-white p-4 shadow-soft">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4B5563]">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold text-[#111111]">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.caption}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,320px)]">
        <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">Recent Orders</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Showing the latest 5 recorded orders. Open orders for the full list.</p>
            </div>
            <Link
              to="/admin/orders"
              className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-[#111111] transition-colors hover:bg-[#F5F5F7] sm:inline-flex"
            >
              View Orders
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-3 pr-3">Customer</th>
                  <th className="pb-3 pr-3">Products</th>
                  <th className="pb-3 pr-3">Amount</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Date</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).map((order: any) => (
                  <tr key={order.id} className="border-b border-border/70 transition-colors hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-[#111111]">{order.customer_name || "Walk-in customer"}</div>
                      <div className="text-xs text-muted-foreground">{order.customer_phone || "Phone not captured"}</div>
                    </td>
                    <td className="py-3 pr-3 text-[#4B5563]">{summarizeItems(order.items)}</td>
                    <td className="py-3 pr-3 font-semibold text-[#111111]">{formatKES(Number(order.total ?? 0))}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                          STATUS_STYLES[String(order.status ?? "pending")] ?? "bg-[#F5F5F7] text-[#4B5563]",
                        )}
                      >
                        {String(order.status ?? "pending")}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-[#4B5563]">
                      {new Date(order.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3">
                      <Link
                        to="/admin/orders"
                        className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-[#111111] transition-colors hover:bg-[#F5F5F7]"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {(data?.recent ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      No orders recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111111]">Quick Actions</h3>
              <Plus className="h-4 w-4 text-[#E30613]" />
            </div>
            <div className="mt-4 grid gap-2.5">
              <QuickAction label="Add Expense" icon={ChartColumn} to="/admin/expenses" primary />
              <QuickAction label="View Orders" icon={ShoppingBag} to="/admin/orders" />
            </div>
          </div>

          <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111111]">Notifications</h3>
              <BellRing className="h-4 w-4 text-[#E30613]" />
            </div>
            <div className="mt-4 space-y-3">
              {notifications.map((notification) => (
                <div key={notification.title} className="flex gap-3 rounded-[1.25rem] border border-border p-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF1F2] text-[#E30613]">
                    <notification.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">{notification.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#4B5563]">{notification.description}</p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">{notification.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,360px)]">
        <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">Top Performing Products</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Showing the top 5 products by actual inquiry volume and revenue from orders.</p>
            </div>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-[#111111] transition-colors hover:bg-[#F5F5F7]"
            >
              View Storefront
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {(data?.products.top ?? []).map((product: any) => (
              <div
                key={product.slug}
                className="grid min-w-0 gap-3 rounded-[1.25rem] border border-border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[60px_minmax(0,1fr)_minmax(0,120px)_minmax(0,132px)]"
              >
                <ProductThumb title={product.title} image={product.image} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111111]">{product.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{product.inquiries} inquiries captured</p>
                </div>
                <MetricPill label="Inquiries" value={formatNumber(product.inquiries)} />
                <MetricPill label="Revenue" value={formatKES(product.revenue)} strong />
              </div>
            ))}
            {(data?.products.top ?? []).length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Product performance will appear here once inquiries start coming in.
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">Low Stock Alerts</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Prioritize fast-moving items that need replenishment.</p>
            </div>
            <CircleAlert className="h-5 w-5 text-[#E30613]" />
          </div>

          <div className="mt-4 space-y-3">
            {(data?.products.lowStock ?? []).map((product: any) => (
              <div key={product.id} className="flex items-center gap-3 rounded-[1.25rem] border border-border p-3">
                <ProductThumb title={product.title} image={product.image} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#111111]">{product.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">{product.stock_status.replaceAll("_", " ")}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[#F6C9CD] bg-[#FFF1F2] px-3 py-1.5 text-[11px] font-semibold text-[#E30613] transition-colors hover:bg-[#FFE4E7]"
                >
                  Restock
                </button>
              </div>
            ))}
            {(data?.products.lowStock ?? []).length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No low stock products right now.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#111111]">Recent Expenses</h3>
            <p className="mt-1 text-xs text-[#4B5563]">Latest recorded operating expenses across the business.</p>
          </div>
          <Link
            to="/admin/expenses"
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-[#111111] transition-colors hover:bg-[#F5F5F7]"
          >
            View Expenses
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
          {(data?.expenses ?? []).slice(0, 3).map((expense: any) => (
            <div key={expense.id} className="min-w-0 rounded-[1.25rem] border border-border p-4">
              <p className="truncate text-sm font-semibold text-[#111111]">{expense.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{expense.category} • {new Date(expense.expense_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}</p>
              <p className="mt-3 text-lg font-bold text-[#111111]">{formatKES(expense.amount)}</p>
            </div>
          ))}
          {(data?.expenses ?? []).length === 0 && (
            <div className="rounded-[1.25rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-3">
              No expenses recorded yet.
            </div>
          )}
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-[#111111]">Traffic Sources</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Actual storefront traffic captured in the last 30 days.</p>
            </div>
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-[#111111] transition-colors hover:bg-[#F5F5F7]"
            >
              Analytics Page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {trafficSources.length > 0 ? (
            <div className="mt-4 grid min-w-0 items-center gap-4 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
              <ChartContainer
                config={Object.fromEntries(
                  trafficSources.map((source: any) => [source.name, { label: source.name, color: source.color }]),
                )}
                className="mx-auto h-[180px] w-[180px]"
              >
                <PieChart>
                  <Pie
                    data={trafficSources}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {trafficSources.map((entry: any) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-semibold text-[#111111]">
                              {Number(value).toLocaleString()} visits
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                </PieChart>
              </ChartContainer>

              <div className="min-w-0 space-y-2.5">
                {trafficSources.map((source: any) => (
                  <div key={source.name} className="flex min-w-0 items-center justify-between gap-3 rounded-[1rem] border border-border px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: source.color }} />
                      <span className="truncate text-sm font-medium text-[#111111]">{source.name}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-[#4B5563]">{Number(source.value).toLocaleString()}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {totalTraffic ? Math.round((Number(source.value) / totalTraffic) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-border bg-[#FAFAFA] p-5">
              <p className="text-sm font-semibold text-[#111111]">No traffic events recorded yet</p>
              <p className="mt-2 text-xs leading-5 text-[#4B5563]">
                Traffic-source analytics will start appearing here after new storefront visits are recorded.
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-[#111111]">Device Analytics</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Actual device mix from storefront visits captured in the last 30 days.</p>
            </div>
            <Monitor className="h-5 w-5 shrink-0 text-[#E30613]" />
          </div>

          {deviceAnalytics.length > 0 ? (
            <div className="mt-4 space-y-3">
              {deviceAnalytics.map((device: any) => {
                const share = totalDevices ? Math.round((Number(device.users ?? 0) / totalDevices) * 100) : 0;
                return (
                  <div key={device.label} className="min-w-0 rounded-[1.25rem] border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111111]">{device.label}</p>
                        <p className="text-xs text-muted-foreground">{Number(device.users ?? 0).toLocaleString()} visits</p>
                      </div>
                      <span className="shrink-0 text-base font-bold text-[#111111]">{share}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[#F5F5F7]">
                      <div className="h-2 rounded-full bg-[#E30613]" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-border bg-[#FAFAFA] p-5">
              <p className="text-sm font-semibold text-[#111111]">No device events recorded yet</p>
              <p className="mt-2 text-xs leading-5 text-[#4B5563]">
                Device analytics will start appearing here after new storefront visits are recorded.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardRefreshButton({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-3 text-xs font-semibold text-[#111111] shadow-sm transition-colors hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={cn("h-4 w-4 text-[#E30613]", busy && "animate-spin")} />
      {busy ? "Refreshing" : "Refresh"}
    </button>
  );
}

function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  spark,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
  spark: { value: number }[];
}) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-border bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(17,17,17,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4B5563]">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-[#111111]">{value}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF1F2] text-[#E30613]">
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="rounded-full bg-[#FFF1F2] px-2.5 py-1 text-[11px] font-semibold text-[#E30613]">{trend}</span>
        <ChartContainer config={{ value: { label: "Value", color: "#E30613" } }} className="h-10 w-20">
          <LineChart data={spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  icon: Icon,
  to,
  primary,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  primary?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-xl",
          primary ? "bg-white/20 text-white" : "bg-[#F5F5F7] text-[#111111]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
      <ArrowRight className="ml-auto h-4 w-4" />
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-xs font-semibold transition-all hover:-translate-y-0.5",
    primary
      ? "bg-[#E30613] text-white shadow-[0_12px_24px_rgba(227,6,19,0.18)]"
      : "border border-border bg-white text-[#111111] hover:bg-[#F5F5F7]",
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className}>
      {content}
    </button>
  );
}

function ProductThumb({ title, image, small }: { title: string; image?: string | null; small?: boolean }) {
  return image ? (
    <img
      src={image}
      alt={title}
      className={cn(
        "rounded-[1rem] border border-border bg-white object-contain object-center",
        small ? "h-12 w-12" : "h-[60px] w-[60px]",
      )}
    />
  ) : (
    <div
      className={cn(
        "grid place-items-center rounded-[1rem] border border-border bg-[#F5F5F7] text-[#9CA3AF]",
        small ? "h-12 w-12" : "h-[60px] w-[60px]",
      )}
    >
      <Package className="h-4 w-4" />
    </div>
  );
}

function MetricPill({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-[1rem] bg-[#FAFAFA] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 truncate text-xs font-semibold", strong ? "text-[#111111]" : "text-[#4B5563]")}>{value}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function summarizeItems(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return "No products listed";
  const titles = items.map((item) => item?.title).filter(Boolean);
  if (titles.length === 0) return "Custom inquiry";
  if (titles.length === 1) return titles[0];
  return `${titles[0]} +${titles.length - 1} more`;
}

function buildSparkData(seed: number, offset: number) {
  const base = Math.max(8, seed || 12);
  return Array.from({ length: 7 }, (_, index) => ({
    value: Math.max(4, Math.round(base * (0.62 + ((index + offset) % 5) * 0.11))),
  }));
}

function buildNotifications({
  role,
  pending,
  completed,
  lowStock,
  upcomingBills,
  overdueTakeouts,
  recent,
}: {
  role: string | null;
  pending: number;
  completed: number;
  lowStock: number;
  upcomingBills: any[];
  overdueTakeouts: any[];
  recent: any[];
}) {
  const notifications = [];

  if (overdueTakeouts.length > 0) {
    const firstTakeout = overdueTakeouts[0];
    notifications.push({
      title: `${overdueTakeouts.length} take-out product${overdueTakeouts.length > 1 ? "s" : ""} need status update`,
      description: `${firstTakeout.product_title ?? "Product"} (${firstTakeout.serial_code ?? "serial"}) has not been marked returned or sold within 24 hours.`,
      time: "Take-out",
      icon: ArrowRight,
    });
  }

  if (role === "super_admin" && upcomingBills.length > 0) {
    const nextBill = upcomingBills[0];
    notifications.push({
      title: `${upcomingBills.length} supplier bill${upcomingBills.length > 1 ? "s" : ""} due soon`,
      description: `${nextBill.supplier_name} bill ${nextBill.bill_number} is due on ${new Date(nextBill.due_date).toLocaleDateString("en-KE", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}.`,
      time: "Finance",
      icon: DollarSign,
    });
  }

  if (pending > 0) {
    notifications.push({
      title: `${pending} enquir${pending === 1 ? "y" : "ies"} awaiting follow-up`,
      description:
        pending === 1
          ? "There is 1 enquiry in the queue that still needs a response."
          : `There are ${pending} enquiries in the queue that still need responses.`,
      time: "Enquiries",
      icon: MessageCircleMore,
    });
  }

  if (lowStock > 0) {
    notifications.push({
      title: `${lowStock} low-stock product${lowStock > 1 ? "s" : ""}`,
      description:
        lowStock === 1
          ? "1 product is running low and may need restocking soon."
          : `${lowStock} products are running low and may need restocking soon.`,
      time: "Inventory",
      icon: CircleAlert,
    });
  }

  if (recent[0]) {
    const latestOrder = recent[0];
    const customerName = latestOrder.customer_name || "Walk-in customer";
    notifications.push({
      title: `Latest order from ${customerName}`,
      description: `${summarizeItems(latestOrder.items)} recorded at ${formatKES(Number(latestOrder.total ?? 0))}.`,
      time: new Date(latestOrder.created_at).toLocaleDateString("en-KE", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      icon: Users,
    });
  }

  if (completed > 0) {
    notifications.push({
      title: `${completed} completed order${completed > 1 ? "s" : ""}`,
      description:
        completed === 1
          ? "1 order has been marked as completed."
          : `${completed} orders have been marked as completed.`,
      time: "Orders",
      icon: BadgeCheck,
    });
  }

  if (notifications.length === 0) {
    notifications.push({
      title: "No new operational alerts",
      description: "New enquiry, inventory, billing, and order updates will appear here as activity is recorded.",
      time: "Overview",
      icon: BellRing,
    });
  }

  return notifications.slice(0, 4);
}
