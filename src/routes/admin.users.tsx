import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAdminUser, listAdminUsers, setAdminUserActive, upsertAdminUser, type AdminRole } from "@/lib/admin-auth";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

const emptyForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "admin" as AdminRole,
  is_active: true,
};

function AdminUsers() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers(),
  });

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!form.id && !form.password.trim()) {
      toast.error("Password is required for a new admin profile");
      return;
    }

    await upsertAdminUser({
      id: form.id || undefined,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim() || undefined,
      role: form.role,
      is_active: form.is_active,
    });

    toast.success(form.id ? "Admin profile updated" : "Admin profile created");
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const edit = (user: any) => {
    setForm({
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      password: "",
      role: user.role === "super_admin" ? "super_admin" : user.role === "attendant" ? "attendant" : "admin",
      is_active: Boolean(user.is_active),
    });
  };

  const toggleActive = async (user: any) => {
    await setAdminUserActive(user.id, !user.is_active);
    toast.success(user.is_active ? "Admin profile deactivated" : "Admin profile activated");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const remove = async (user: any) => {
    if (!confirm(`Delete ${user.name}?`)) return;
    await deleteAdminUser(user.id);
    toast.success("Admin profile deleted");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin Users</h1>
        <p className="text-sm text-muted-foreground">
          Super admin can create, activate, deactivate, and delete dashboard login profiles.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">{form.id ? "Edit Admin Profile" : "Create Admin Profile"}</h2>
          <div className="mt-4 space-y-3">
            <Field label="Full name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </Field>
            <Field label={form.id ? "New password (optional)" : "Password"}>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} placeholder={form.id ? "Leave empty to keep existing password" : "Create a secure password"} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })} className={inputCls}>
                <option value="attendant">Attendant</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Profile is active
            </label>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-full" onClick={save}>
                {form.id ? "Save profile" : "Create profile"}
              </Button>
              {form.id ? (
                <Button variant="outline" className="rounded-full" onClick={() => setForm(emptyForm)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Profile</th>
                <th>Role</th>
                <th>Status</th>
                <th>Source</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td>
                    <span className="rounded-full bg-[#FFF1F2] px-2.5 py-1 text-xs font-semibold text-[#E30613]">
                      {formatRole(user.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.is_active ? "bg-[#ECFDF3] text-[#15803D]" : "bg-[#FEF2F2] text-[#B91C1C]"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{user.source}</span>
                      {user.is_protected ? (
                        <span className="rounded-full bg-[#F5F5F7] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#4B5563]">
                          Protected
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" className="rounded-full" onClick={() => edit(user)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="rounded-full" onClick={() => toggleActive(user)}>
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      {!user.is_protected ? (
                        <Button variant="ghost" className="rounded-full text-primary" onClick={() => remove(user)}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function formatRole(role: AdminRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "attendant") return "Attendant";
  return "Admin";
}
