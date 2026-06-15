import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listAdminInquiries } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/enquiries")({ component: AdminEnquiries });

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

function AdminEnquiries() {
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]["value"]>("all");
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]["value"]>("date-desc");
  const [page, setPage] = useState(1);

  const { data: inquiries = [] } = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: () => listAdminInquiries(),
  });

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();

    const next = inquiries.filter((entry: any) => {
      if (timeRange !== "all") {
        const createdAt = new Date(entry.created_at).getTime();
        const maxAge = Number(timeRange) * 24 * 60 * 60 * 1000;
        if (Number.isNaN(createdAt) || now - createdAt > maxAge) {
          return false;
        }
      }

      if (!normalizedQuery) return true;

      const haystack = [
        entry.customer_name,
        entry.customer_phone,
        entry.message,
        ...(Array.isArray(entry.items) ? entry.items.map((item: any) => item?.title) : []),
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
  }, [inquiries, query, sortBy, timeRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEntries = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      <header className="rounded-[1.5rem] border border-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Enquiries</h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              {filtered.length.toLocaleString()} matching enquiries out of {inquiries.length.toLocaleString()} total
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_170px]">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-[#F5F5F7] px-3 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search customer, phone, product"
                className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-muted-foreground"
              />
            </label>

            <select
              value={timeRange}
              onChange={(event) => {
                setTimeRange(event.target.value as (typeof TIME_RANGES)[number]["value"]);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-[#111111] outline-none"
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
              className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-[#111111] outline-none"
            >
              {SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-[1.5rem] border border-border bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-[#FAFAFA]">
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {pagedEntries.map((entry: any) => (
                <tr key={entry.id} className="border-b border-border/70 align-top transition-colors hover:bg-[#FAFAFA]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[#111111]">{entry.customer_name || "Anonymous"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{entry.customer_phone || "-"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-[280px] space-y-1 text-xs text-[#4B5563]">
                      {(entry.items || []).slice(0, 3).map((item: any, index: number) => (
                        <div key={index} className="truncate">
                          {item.title} x{item.qty ?? item.quantity ?? 1}
                        </div>
                      ))}
                      {(entry.items || []).length > 3 && (
                        <div className="text-muted-foreground">+{entry.items.length - 3} more</div>
                      )}
                      {(entry.items || []).length === 0 && <div className="text-muted-foreground">No items listed</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#111111]">{formatKES(Number(entry.total))}</td>
                  <td className="px-4 py-4 text-xs text-[#4B5563]">
                    {new Date(entry.created_at).toLocaleDateString()} <br />
                    <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleTimeString()}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No enquiries match the current search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="flex flex-col gap-3 rounded-[1.5rem] border border-border bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#4B5563]">
          Showing {pageStart} to {pageEnd} of {filtered.length.toLocaleString()} matching enquiries
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
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
