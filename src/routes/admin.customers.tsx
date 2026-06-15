import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAdminCustomers } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const { data: customers = [] } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => listAdminCustomers(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th>Phone</th><th>First Seen</th></tr>
          </thead>
          <tbody>
            {customers.map((customer: any) => (
              <tr key={customer.id} className="border-t">
                <td className="px-4 py-3 font-medium">{customer.full_name || "Guest customer"}</td>
                <td className="text-muted-foreground">{customer.phone || "-"}</td>
                <td className="text-muted-foreground">{new Date(customer.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-muted-foreground">No customer records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
