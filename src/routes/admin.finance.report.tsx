import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Component, useState, type ReactNode } from "react";
import { CircleDollarSign, ClipboardList, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { fetchFinanceReport } from "@/lib/admin-data";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/finance/report")({
  component: AdminFinanceReport,
});

const PERIOD_OPTIONS = [
  { value: "month", label: "This month" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "all", label: "All time" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

const DEFAULT_SUMMARY = {
  revenue: 0,
  expenses: 0,
  set_prices: 0,
  sold_unpaid_amount: 0,
  profit: 0,
  order_count: 0,
  expense_count: 0,
  sold_item_count: 0,
  sold_unpaid_count: 0,
  margin: 0,
};

function AdminFinanceReport() {
  const { user } = useAuth();
  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const [period, setPeriod] = useState<PeriodValue>("month");
  const { data, isLoading } = useQuery({
    queryKey: ["finance-report", period],
    queryFn: () => fetchFinanceReport({ period, actor }),
    enabled: actor?.role === "super_admin",
  });

  if (actor?.role !== "super_admin") {
    return (
      <div className="rounded-[1.5rem] border border-border bg-white p-6 shadow-soft">
        <h1 className="text-xl font-bold text-[#111111]">Role access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only super admin can view the finance report.</p>
      </div>
    );
  }

  const summary = { ...DEFAULT_SUMMARY, ...(data?.summary ?? {}) };
  const series = (Array.isArray(data?.series) ? data.series : []).map((point) => ({
      ...point,
      setPrices: point.set_prices ?? 0,
    }));
  const revenueBySource = Array.isArray(data?.revenueBySource) ? data.revenueBySource : [];
  const expensesByCategory = Array.isArray(data?.expensesByCategory) ? data.expensesByCategory : [];
  const recentExpenses = Array.isArray(data?.recentExpenses) ? data.recentExpenses : [];

  const cards = [
    {
      label: "Revenue",
      value: formatKES(summary.revenue),
      caption: `${summary.order_count.toLocaleString()} non-cancelled orders`,
      icon: CircleDollarSign,
    },
    {
      label: "Sold Item Set Prices",
      value: formatKES(summary.set_prices),
      caption: `${summary.sold_item_count.toLocaleString()} serial-linked sold items`,
      icon: ClipboardList,
    },
    {
      label: "Sold Unpaid Stock",
      value: formatKES(summary.sold_unpaid_amount),
      caption: `${summary.sold_unpaid_count.toLocaleString()} partially or fully unpaid sold serials`,
      icon: TrendingDown,
      strong: false,
    },
    {
      label: "Expenses",
      value: formatKES(summary.expenses),
      caption: `${summary.expense_count.toLocaleString()} expense records`,
      icon: ReceiptText,
    },
    {
      label: "Profit",
      value: formatKES(summary.profit),
      caption: `After set prices and expenses - ${summary.margin}% margin`,
      icon: TrendingUp,
      strong: summary.profit >= 0,
    },
  ];

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-5">
      <section className="min-w-0 rounded-[1.25rem] border border-border bg-white p-4 shadow-soft sm:rounded-[1.5rem] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#111111] sm:text-2xl">Financial Report</h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Revenue, expenses, and profit performance for the selected period.
            </p>
          </div>

          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#4B5563] sm:min-w-[180px]">
            Period
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodValue)}
              className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#111111] shadow-sm outline-none transition focus:border-[#111111]"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="min-w-0 rounded-[0.85rem] border border-border bg-white p-2.5 shadow-soft sm:rounded-[1.25rem] sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-1.5 sm:gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase leading-tight tracking-[0.04em] text-[#4B5563] sm:text-xs sm:tracking-[0.12em]">{card.label}</p>
                <p className={cn("mt-1.5 break-words text-[13px] font-bold leading-tight sm:mt-2 sm:text-2xl", card.strong === false ? "text-[#B91C1C]" : "text-[#111827]")}>
                  {card.value}
                </p>
                <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground sm:mt-2 sm:text-xs sm:leading-snug">{card.caption}</p>
              </div>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#FFF1F2] text-[#E30613] sm:h-10 sm:w-10 sm:rounded-xl">
                <card.icon className="h-3 w-3 sm:h-4 sm:w-4" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0 overflow-hidden rounded-[1.25rem] border border-border bg-white p-4 shadow-soft sm:rounded-[1.5rem] sm:p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#111111]">Revenue, Set Prices, Expenses & Profit</h2>
            <p className="mt-1 text-xs text-[#4B5563]">
              Profit is calculated as revenue minus sold item set prices and expenses.
            </p>
          </div>

          <ChartPanelFallback>
          <div className="mt-4 min-w-0 overflow-hidden">
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "#111111" },
                setPrices: { label: "Sold item set prices", color: "#6B7280" },
                expenses: { label: "Expenses", color: "#E30613" },
                profit: { label: "Profit", color: "#16A34A" },
              }}
              className="h-[250px] w-full sm:h-[330px]"
            >
              <AreaChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-semibold text-[#111111]">{formatKES(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="#11111110" strokeWidth={2.5} />
                <Area type="monotone" dataKey="setPrices" stroke="var(--color-setPrices)" fill="#6B728012" strokeWidth={2.5} />
                <Area type="monotone" dataKey="expenses" stroke="var(--color-expenses)" fill="#E3061314" strokeWidth={2.5} />
                <Area type="monotone" dataKey="profit" stroke="var(--color-profit)" fill="#16A34A12" strokeWidth={2.5} />
              </AreaChart>
            </ChartContainer>
          </div>
          </ChartPanelFallback>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[1.25rem] border border-border bg-white p-4 shadow-soft sm:rounded-[1.5rem] sm:p-5">
          <h2 className="text-lg font-bold text-[#111111]">Expenses by Category</h2>
          <p className="mt-1 text-xs text-[#4B5563]">Largest operating costs in the selected period.</p>

          <ChartPanelFallback>
          <div className="mt-4 min-w-0 overflow-hidden">
            <ChartContainer
              config={{ value: { label: "Expenses", color: "#E30613" } }}
              className="h-[250px] w-full sm:h-[300px]"
            >
              <BarChart data={expensesByCategory} layout="vertical" margin={{ top: 8, right: 8, left: 16, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={72} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-semibold text-[#111111]">{formatKES(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="value" fill="var(--color-value)" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ChartContainer>
          </div>
          </ChartPanelFallback>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <BreakdownList title="Revenue by Source" items={revenueBySource} total={summary.revenue} empty="No revenue recorded." />
        <RecentExpenses items={recentExpenses} loading={isLoading} />
      </section>
    </div>
  );
}

function BreakdownList({
  title,
  items,
  total,
  empty,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  total: number;
  empty: string;
}) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-border bg-white p-4 shadow-soft sm:rounded-[1.5rem] sm:p-5">
      <h2 className="text-lg font-bold text-[#111111]">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const share = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="min-w-0 rounded-[1rem] border border-border p-3">
              <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-[#111111]">{item.label}</span>
                <span className="shrink-0 text-xs text-[#4B5563] sm:text-sm">{formatKES(item.value)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#F5F5F7]">
                <div className="h-2 rounded-full bg-[#111111]" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{share}% of revenue</p>
            </div>
          );
        })}
        {items.length === 0 ? <EmptyState text={empty} /> : null}
      </div>
    </div>
  );
}

function RecentExpenses({ items, loading }: { items: Array<{ id: string; title: string; category: string; amount: number; expense_date: string }>; loading: boolean }) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-border bg-white p-4 shadow-soft sm:rounded-[1.5rem] sm:p-5">
      <h2 className="text-lg font-bold text-[#111111]">Recent Expenses</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-[1rem] border border-border px-3 py-3 sm:gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111111]">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.category} - {formatDate(item.expense_date)}
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-[#111111] sm:text-sm">{formatKES(item.amount)}</span>
          </div>
        ))}
        {items.length === 0 ? <EmptyState text={loading ? "Loading expenses..." : "No expenses recorded."} /> : null}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-border bg-[#FAFAFA] p-5">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

class ChartPanelFallback extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return <EmptyState text="The graph could not load, but the report totals are still available." />;
    }

    return this.props.children;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}
