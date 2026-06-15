import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteSupplier, listSuppliers, upsertSupplier } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/suppliers")({ component: AdminSuppliers });

const emptyForm = {
  id: "",
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function AdminSuppliers() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
  });

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    await upsertSupplier({
      id: form.id || undefined,
      name: form.name.trim(),
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    });

    toast.success(form.id ? "Supplier updated" : "Supplier added");
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const edit = (supplier: any) => {
    setForm({
      id: supplier.id,
      name: supplier.name ?? "",
      contact_person: supplier.contact_person ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    await deleteSupplier(id);
    toast.success("Supplier deleted");
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
        <p className="text-sm text-muted-foreground">Super admin supplier directory for procurement and contact management.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">{form.id ? "Edit Supplier" : "Add Supplier"}</h2>
          <div className="mt-4 space-y-3">
            <Field label="Supplier name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Contact person"><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Address"><textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} /></Field>
            <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-full" onClick={save}>{form.id ? "Update supplier" : "Save supplier"}</Button>
              {form.id ? (
                <Button variant="outline" className="rounded-full" onClick={() => setForm(emptyForm)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier: any) => (
                <tr key={supplier.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{supplier.name}</p>
                    <p className="text-xs text-muted-foreground">{supplier.address ?? "No address added"}</p>
                  </td>
                  <td>{supplier.contact_person ?? "-"}</td>
                  <td>{supplier.phone ?? "-"}</td>
                  <td>{supplier.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" className="rounded-full" onClick={() => edit(supplier)}>Edit</Button>
                      <Button variant="ghost" className="rounded-full text-primary" onClick={() => remove(supplier.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No suppliers saved yet.</td>
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

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
