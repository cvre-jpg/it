import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteReseller, listResellers, upsertReseller } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/resellers")({ component: AdminResellers });

const emptyForm = {
  id: "",
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function AdminResellers() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { data: resellers = [] } = useQuery({
    queryKey: ["resellers"],
    queryFn: () => listResellers(),
  });

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Reseller name is required");
      return;
    }

    await upsertReseller({
      id: form.id || undefined,
      name: form.name.trim(),
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    });

    toast.success(form.id ? "Reseller updated" : "Reseller added");
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["resellers"] });
  };

  const edit = (reseller: any) => {
    setForm({
      id: reseller.id,
      name: reseller.name ?? "",
      contact_person: reseller.contact_person ?? "",
      phone: reseller.phone ?? "",
      email: reseller.email ?? "",
      address: reseller.address ?? "",
      notes: reseller.notes ?? "",
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this reseller?")) return;
    await deleteReseller(id);
    toast.success("Reseller deleted");
    qc.invalidateQueries({ queryKey: ["resellers"] });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Resellers</h1>
        <p className="text-sm text-muted-foreground">Super admin reseller directory for partner and contact management.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">{form.id ? "Edit Reseller" : "Add Reseller"}</h2>
          <div className="mt-4 space-y-3">
            <Field label="Reseller name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Contact person"><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Address"><textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} /></Field>
            <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-full" onClick={save}>{form.id ? "Update reseller" : "Save reseller"}</Button>
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
                  <th className="px-4 py-3">Reseller</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((reseller: any) => (
                  <tr key={reseller.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium">{reseller.name}</p>
                      <p className="text-xs text-muted-foreground">{reseller.address ?? "No address added"}</p>
                    </td>
                    <td>{reseller.contact_person ?? "-"}</td>
                    <td>{reseller.phone ?? "-"}</td>
                    <td>{reseller.email ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="rounded-full" onClick={() => edit(reseller)}>Edit</Button>
                        <Button variant="ghost" className="rounded-full text-primary" onClick={() => remove(reseller.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {resellers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No resellers saved yet.</td>
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
