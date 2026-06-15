import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CircleDollarSign,
  Globe,
  MousePointerClick,
  Route as RouteIcon,
  ShoppingBag,
  Smartphone,
  Users,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatKES } from "@/lib/format";
import { fetchAdminAnalytics } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/analytics")({ component: AdminAnalytics });

const RANGE_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "365 Days", value: 365 },
] as const;

const CHART_COLORS = ["#111111", "#E30613", "#6B7280", "#F87171", "#D1D5DB", "#9CA3AF"];

function AdminAnalytics() {
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]["value"]>(30);
  const { data } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fetchAdminAnalytics(days),
  });

  const trafficSources = useMemo(
    () =>
      (data?.trafficSources ?? []).map((item: any, index: number) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [data?.trafficSources],
  );
  const inquirySources = useMemo(
    () =>
      (data?.inquirySources ?? []).map((item: any, index: number) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [data?.inquirySources],
  );
  const totalTraffic = useMemo(
    () => trafficSources.reduce((sum: number, item: any) => sum + Number(item.value ?? 0), 0),
    [trafficSources],
  );
  const totalDeviceVisits = useMemo(
    () => (data?.deviceAnalytics ?? []).reduce((sum: number, item: any) => sum + Number(item.users ?? 0), 0),
    [data?.deviceAnalytics],
  );

  const cards = [
    {
      label: "Inquiry Volume",
      value: data?.count?.toLocaleString() ?? "-",
      caption: `Orders submitted in the last ${days} days`,
      icon: ShoppingBag,
    },
    {
      label: "Revenue Captured",
      value: formatKES(data?.total ?? 0),
      caption: "Confirmed inquiry value during selected period",
      icon: CircleDollarSign,
    },
    {
      label: "Conversion Rate",
      value: `${data?.conv ?? 0}%`,
      caption: "Completed orders over total inquiries",
      icon: BarChart3,
    },
    {
      label: "Average Order Value",
      value: formatKES(data?.aov ?? 0),
      caption: "Average value per inquiry order",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#111111]">Analytics Report</h2>
            <p className="mt-1 text-sm text-[#4B5563]">
              Detailed storefront and order reporting with selectable time ranges.
            </p>
          </div>

          <div className="inline-flex w-fit rounded-xl border border-border bg-[#F5F5F7] p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDays(option.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  days === option.value ? "bg-white text-[#111111] shadow-sm" : "text-[#4B5563] hover:text-[#111111]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[1.25rem] border border-border bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4B5563]">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#111111]">{card.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{card.caption}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF1F2] text-[#E30613]">
                <card.icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_340px]">
        <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div>
            <h3 className="text-lg font-bold text-[#111111]">Revenue, Visits & Inquiry Trend</h3>
            <p className="mt-1 text-xs text-[#4B5563]">Daily report for the selected range.</p>
          </div>

          <div className="mt-4">
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "#E30613" },
                visits: { label: "Visits", color: "#111111" },
                inquiries: { label: "Inquiries", color: "#6B7280" },
              }}
              className="h-[320px] w-full"
            >
              <AreaChart data={data?.series ?? []} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
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
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="#E3061316"
                  strokeWidth={2.5}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="visits"
                  stroke="var(--color-visits)"
                  fill="#1111110D"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="inquiries"
                  stroke="var(--color-inquiries)"
                  fill="#6B72800F"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        <div className="space-y-4">
          <StatusCard title="Inquiry Status Breakdown" byStatus={data?.byStatus ?? {}} total={data?.count ?? 0} />
          <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
            <h3 className="text-base font-bold text-[#111111]">Customer Snapshot</h3>
            <div className="mt-4 space-y-3">
              <MiniStat label="Unique ordering customers" value={(data?.customers ?? 0).toLocaleString()} />
              <MiniStat label="Storefront visits tracked" value={totalTraffic.toLocaleString()} />
              <MiniStat label="Device visits tracked" value={totalDeviceVisits.toLocaleString()} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <TrafficCard title="Traffic Sources" data={trafficSources} emptyText="No traffic data for this period." />
        <SourceBarsCard title="Inquiry Source Performance" data={inquirySources} emptyText="No inquiry source data for this period." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">Device Analytics</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Real device mix from tracked storefront visits.</p>
            </div>
            <Smartphone className="h-5 w-5 text-[#E30613]" />
          </div>

          <div className="mt-4 space-y-3">
            {(data?.deviceAnalytics ?? []).map((device: any) => {
              const share = totalDeviceVisits ? Math.round((Number(device.users ?? 0) / totalDeviceVisits) * 100) : 0;
              return (
                <div key={device.label} className="rounded-[1.25rem] border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">{device.label}</p>
                      <p className="text-xs text-muted-foreground">{Number(device.users ?? 0).toLocaleString()} visits</p>
                    </div>
                    <span className="text-base font-bold text-[#111111]">{share}%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#F5F5F7]">
                    <div className="h-2 rounded-full bg-[#E30613]" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
            {(data?.deviceAnalytics ?? []).length === 0 && <EmptyState text="No device analytics for this period." />}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">Top Pages</h3>
              <p className="mt-1 text-xs text-[#4B5563]">Most-visited storefront paths in the selected range.</p>
            </div>
            <RouteIcon className="h-5 w-5 text-[#E30613]" />
          </div>

          <div className="mt-4 space-y-3">
            {(data?.topPages ?? []).map((page: any, index: number) => (
              <div key={page.pathname} className="flex items-center justify-between rounded-[1rem] border border-border px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111111]">#{index + 1}</p>
                  <p className="truncate text-xs text-muted-foreground">{page.pathname}</p>
                </div>
                <span className="text-sm font-semibold text-[#111111]">{Number(page.visits ?? 0).toLocaleString()}</span>
              </div>
            ))}
            {(data?.topPages ?? []).length === 0 && <EmptyState text="No page-view records for this period." />}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  title,
  byStatus,
  total,
}: {
  title: string;
  byStatus: Record<string, number>;
  total: number;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
      <h3 className="text-base font-bold text-[#111111]">{title}</h3>
      <div className="mt-4 space-y-3">
        {Object.entries(byStatus).map(([status, count]) => {
          const share = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={status}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="capitalize text-[#111111]">{status}</span>
                <span className="font-semibold text-[#4B5563]">
                  {count} ({share}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F5F5F7]">
                <div className="h-2 rounded-full bg-[#E30613]" style={{ width: `${share}%` }} />
              </div>
            </div>
          );
        })}
        {Object.keys(byStatus).length === 0 && <EmptyState text="No inquiry statuses recorded for this period." compact />}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-border bg-[#FAFAFA] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-bold text-[#111111]">{value}</p>
    </div>
  );
}

function TrafficCard({ title, data, emptyText }: { title: string; data: any[]; emptyText: string }) {
  const total = data.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#111111]">{title}</h3>
          <p className="mt-1 text-xs text-[#4B5563]">Source share based on tracked page views.</p>
        </div>
        <Globe className="h-5 w-5 text-[#E30613]" />
      </div>

      {data.length > 0 ? (
        <div className="mt-4 grid items-center gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <ChartContainer
            config={Object.fromEntries(data.map((item) => [item.name, { label: item.name, color: item.color }]))}
            className="mx-auto h-[180px] w-[180px]"
          >
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-semibold text-[#111111]">{Number(value).toLocaleString()} visits</span>
                      </div>
                    )}
                  />
                }
              />
            </PieChart>
          </ChartContainer>

          <div className="space-y-2.5">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-[1rem] border border-border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-[#111111]">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#4B5563]">{Number(item.value).toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {total ? Math.round((Number(item.value) / total) * 100) : 0}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState text={emptyText} />
        </div>
      )}
    </div>
  );
}

function SourceBarsCard({ title, data, emptyText }: { title: string; data: any[]; emptyText: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#111111]">{title}</h3>
          <p className="mt-1 text-xs text-[#4B5563]">Which channels actually generated inquiry submissions.</p>
        </div>
        <MousePointerClick className="h-5 w-5 text-[#E30613]" />
      </div>

      {data.length > 0 ? (
        <div className="mt-4">
          <ChartContainer
            config={Object.fromEntries(data.map((item) => [item.name, { label: item.name, color: item.color }]))}
            className="h-[260px] w-full"
          >
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 12, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeDasharray="4 4" />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={84} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-semibold text-[#111111]">{Number(value).toLocaleString()} inquiries</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState text={emptyText} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-[1.25rem] border border-dashed border-border bg-[#FAFAFA] p-5", compact && "p-4")}>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
