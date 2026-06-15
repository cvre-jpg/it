import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listExpenses, upsertExpense } from "@/lib/admin-data";
import { useAuth } from "@/hooks/use-auth";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/admin/expenses")({ component: AdminExpenses });

const EXPENSE_CATEGORIES = ["Operations", "Rent", "Utilities", "Transport", "Marketing", "Maintenance", "Other"];
const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

function AdminExpenses() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [rangeFilter, setRangeFilter] = useState<(typeof RANGE_OPTIONS)[number]["value"]>("month");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState({
    title: "",
    category: "Operations",
    amount: "",
    expense_date: today(),
    notes: "",
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => listExpenses(),
  });

  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense: any) => {
        const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
        const matchesRange =
          rangeFilter === "all"
            ? true
            : rangeFilter === "month"
              ? expense.expense_date.slice(0, 7) === today().slice(0, 7)
              : isWithinCurrentWeek(expense.expense_date);

        return matchesCategory && matchesRange;
      }),
    [categoryFilter, expenses, rangeFilter],
  );
  const filteredTotal = filteredExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount ?? 0), 0);

  const save = async () => {
    if (!actor) return;
    if (!form.title.trim() || !form.amount) {
      toast.error("Title and amount are required");
      return;
    }

    await upsertExpense({
      title: form.title.trim(),
      category: form.category,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      notes: form.notes || null,
      actor,
    });

    toast.success("Expense recorded");
    setForm({
      title: "",
      category: "Operations",
      amount: "",
      expense_date: today(),
      notes: "",
    });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">Track business expenses from both admin and super admin dashboards.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Add Expense</h2>
          <div className="mt-4 space-y-3">
            <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Courier charge" /></Field>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Amount (KES)"><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} /></Field>
              <Field label="Date"><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className={inputCls} /></Field>
            </div>
            <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
            <Button className="w-full rounded-full" onClick={save}>Save expense</Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="border-b px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Range">
                <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value as (typeof RANGE_OPTIONS)[number]["value"])} className={inputCls}>
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
                  <option value="all">All categories</option>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Expense</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense: any) => (
                <tr key={expense.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{expense.title}</p>
                    <p className="text-xs text-muted-foreground">{expense.notes || "No notes"}</p>
                  </td>
                  <td>{expense.category}</td>
                  <td className="font-semibold">{formatKES(expense.amount)}</td>
                  <td>{formatDate(expense.expense_date)}</td>
                  <td className="text-muted-foreground">{expense.created_by_name || "Admin"}</td>
                </tr>
              ))}
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No expenses match the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </section>
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

function isWithinCurrentWeek(value: string) {
  const target = new Date(value);
  const now = new Date();
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - distanceToMonday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return target >= startOfWeek && target < endOfWeek;
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
