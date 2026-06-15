import { createLazyFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  ClipboardList,
  ChevronDown,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Search,
  Store,
  Truck,
  UserRoundPlus,
  Warehouse,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { listSuperAdminNotifications } from "@/lib/admin-data";
import type { AdminRole } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createLazyFileRoute("/admin")({ component: AdminLayout });

type NavChild = {
  to: string;
  label: string;
  roles?: AdminRole[];
};

type NavItem =
  | {
      to: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      exact?: boolean;
      roles?: AdminRole[];
      children?: never;
    }
  | {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      roles?: AdminRole[];
      children: NavChild[];
      to?: never;
      exact?: never;
    };

const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  {
    label: "Products",
    icon: Package,
    roles: ["attendant"],
    children: [
      { to: "/admin/products/add", label: "Add New Product" },
      { to: "/admin/products/list", label: "Products List" },
    ],
  },
  {
    label: "Catalogue",
    icon: Store,
    roles: ["attendant"],
    children: [
      { to: "/admin/catalogue/add", label: "Add New" },
      { to: "/admin/catalogue/list", label: "List" },
    ],
  },
  {
    label: "Orders",
    icon: ClipboardList,
    roles: ["admin", "super_admin"],
    children: [
      { to: "/admin/orders/create", label: "Create New" },
      { to: "/admin/orders/list", label: "Orders List" },
    ],
  },
  { to: "/admin/enquiries", label: "Enquiries", icon: MessageSquare, roles: ["super_admin"] },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["super_admin"] },
  {
    label: "Finance",
    icon: CreditCard,
    roles: ["admin", "super_admin"],
    children: [
      { to: "/admin/finance/report", label: "Report", roles: ["super_admin"] },
      { to: "/admin/expenses", label: "Expenses", roles: ["admin", "super_admin"] },
      { to: "/admin/bills", label: "Bills", roles: ["super_admin"] },
      { to: "/admin/finance/records", label: "Records", roles: ["admin", "super_admin"] },
    ],
  },
  {
    label: "Inventory",
    icon: Warehouse,
    roles: ["admin", "super_admin"],
    children: [
      { to: "/admin/inventory/stock-intake", label: "Stock Intake", roles: ["admin", "super_admin"] },
      { to: "/admin/inventory/take-out", label: "Take-out", roles: ["admin", "super_admin"] },
      { to: "/admin/inventory/returns", label: "Returns", roles: ["admin", "super_admin"] },
      { to: "/admin/inventory/products", label: "Product List", roles: ["admin", "super_admin"] },
      { to: "/admin/inventory/records", label: "Inventory Records", roles: ["admin", "super_admin"] },
    ],
  },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck, roles: ["super_admin"] },
  { to: "/admin/resellers", label: "Resellers", icon: UserRoundPlus, roles: ["super_admin"] },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, roles: ["super_admin"] },
  { to: "/admin/activity", label: "Activity Logs", icon: History, roles: ["super_admin"] },
  { to: "/admin/settings", label: "Settings", icon: FileText, roles: ["super_admin"] },
];

const PATH_ROLES: Array<{ prefix: string; roles: AdminRole[] }> = [
  { prefix: "/admin/catalogue", roles: ["attendant"] },
  { prefix: "/admin/products", roles: ["attendant"] },
  { prefix: "/admin/orders", roles: ["admin", "super_admin"] },
  { prefix: "/admin/inventory", roles: ["admin", "super_admin"] },
  { prefix: "/admin/expenses", roles: ["admin", "super_admin"] },
  { prefix: "/admin/finance/report", roles: ["super_admin"] },
  { prefix: "/admin/finance", roles: ["admin", "super_admin"] },
  { prefix: "/admin/categories", roles: ["super_admin"] },
  { prefix: "/admin/enquiries", roles: ["super_admin"] },
  { prefix: "/admin/analytics", roles: ["super_admin"] },
  { prefix: "/admin/suppliers", roles: ["super_admin"] },
  { prefix: "/admin/resellers", roles: ["super_admin"] },
  { prefix: "/admin/bills", roles: ["super_admin"] },
  { prefix: "/admin/notifications", roles: ["super_admin"] },
  { prefix: "/admin/activity", roles: ["super_admin"] },
  { prefix: "/admin/settings", roles: ["super_admin"] },
  { prefix: "/admin/users", roles: ["super_admin"] },
  { prefix: "/admin", roles: ["attendant", "admin", "super_admin"] },
];

function AdminLayout() {
  const { user, isAdmin, loading, role, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: superAdminNotifications = [] } = useQuery({
    queryKey: ["super-admin-notifications"],
    queryFn: () => listSuperAdminNotifications(),
    enabled: role === "super_admin",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface px-4">
        <div className="w-full max-w-[320px] space-y-3">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!user) return null;
  if (!isAdmin) return <NoAccess />;
  if (!canAccessPath(path, role)) {
    return <NoAccess title="Role access required" description="Your current role does not have permission to open this section." />;
  }

  const notificationCount =
    role === "super_admin" ? superAdminNotifications.filter((item: any) => !item.is_read).length : 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-foreground lg:pl-72">
      <AdminSidebar
        path={path}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={() => signOut()}
        role={role}
        notificationCount={role === "super_admin" ? superAdminNotifications.filter((item: any) => !item.is_read).length : 0}
      />

      <div className="min-h-screen min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 shadow-[0_1px_2px_rgba(17,17,17,0.04)] backdrop-blur-0">
          <div className="flex h-18 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-foreground transition-colors hover:bg-[#F5F5F7] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden flex-1 justify-center md:flex">
              <label className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border bg-[#F5F5F7] px-4 py-3 shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search products, orders, or enquiries"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 shadow-sm sm:flex">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#111111] text-sm font-semibold text-white">
                  {getInitial(user.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111111]">Admin Profile</p>
                  <p className="truncate text-xs text-muted-foreground">{formatRole(role)} • {user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminSidebar({
  open,
  onClose,
  onLogout,
  path,
  role,
  notificationCount,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  path: string;
  role: AdminRole | null;
  notificationCount: number;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navItems = NAV_ITEMS.filter((item) => isVisibleToRole(item.roles, role));

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-white transition-transform duration-300 lg:z-20 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#111111] text-sm font-bold text-white">
              SI
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#111111]">Shop ICT Gadgets</p>
              <p className="text-xs text-muted-foreground">Admin Console</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border text-[#4B5563] transition-colors hover:bg-[#F5F5F7] lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) =>
              "children" in item ? (
                <SidebarSubmenu
                  key={item.label}
                  item={item}
                  path={path}
                  role={role}
                  open={openMenu === item.label}
                  onToggle={() => setOpenMenu((current) => (current === item.label ? null : item.label))}
                />
              ) : (
                <SidebarLink
                  key={item.to}
                  item={item}
                  active={item.exact ? path === item.to : path.startsWith(item.to)}
                  badgeCount={item.to === "/admin/notifications" ? notificationCount : undefined}
                />
              ),
            )}
          </nav>
        </div>

        <div className="border-t border-border p-3">
          <Link
            to="/"
            className="mb-2 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-[#4B5563] transition-all hover:bg-[#F5F5F7]"
          >
            <Store className="h-4 w-4" />
            View storefront
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-[#4B5563] transition-all hover:bg-[#FFF1F2] hover:text-[#E30613]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  active,
  badgeCount,
}: {
  item: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
  active: boolean;
  badgeCount?: number;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={cn(
        "group flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-[13px] font-medium transition-all",
        active
          ? "border-[#F6C9CD] bg-[#FFF1F2] text-[#E30613] shadow-sm"
          : "border-transparent text-[#4B5563] hover:border-border hover:bg-[#F5F5F7] hover:text-[#111111]",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-xl transition-colors",
          active ? "bg-[#E30613] text-white" : "bg-[#F5F5F7] text-[#4B5563] group-hover:bg-white",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{item.label}</span>
      {badgeCount && badgeCount > 0 ? (
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#E30613] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarSubmenu({
  item,
  path,
  role,
  open,
  onToggle,
}: {
  item: Extract<NavItem, { children: NavChild[] }>;
  path: string;
  role: AdminRole | null;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  const children = item.children.filter((child) => isVisibleToRole(child.roles, role));
  if (children.length === 0) return null;
  const active = children.some((child) => path.startsWith(child.to));

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-[13px] font-medium transition-all",
          active
            ? "border-[#F6C9CD] bg-[#FFF1F2] text-[#E30613] shadow-sm"
            : "border-transparent text-[#4B5563] hover:border-border hover:bg-[#F5F5F7] hover:text-[#111111]",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-xl transition-colors",
            active ? "bg-[#E30613] text-white" : "bg-[#F5F5F7] text-[#4B5563]",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span>{item.label}</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>

      {open ? (
        <div className="mt-2 ml-3 space-y-1 border-l border-border pl-3">
          {children.map((child) => (
            <Link
              key={`${item.label}-${child.label}`}
              to={child.to}
              className={cn(
                "block rounded-xl px-2.5 py-2 text-[13px] transition-colors",
                path.startsWith(child.to) ? "bg-[#FFF1F2] font-medium text-[#E30613]" : "text-[#4B5563] hover:bg-[#F5F5F7] hover:text-[#111111]",
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoAccess({
  title = "Admin access required",
  description = "Sign in with your admin credentials to access the dashboard.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-6">
      <div className="max-w-md rounded-[2rem] border border-border bg-white p-8 text-center shadow-soft">
        <h1 className="text-2xl font-bold text-[#111111]">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-full bg-[#E30613] px-5 py-2.5 text-sm font-medium text-white"
          >
            Go to admin login
          </Link>
          <Link to="/" className="text-sm font-medium text-[#E30613] hover:underline">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

function getInitial(email: string | undefined) {
  return (email?.trim().charAt(0) || "A").toUpperCase();
}

function canAccessPath(path: string, role: AdminRole | null) {
  if (!role) return false;
  const match = PATH_ROLES.find((item) => path.startsWith(item.prefix));
  return match ? match.roles.includes(role) : true;
}

function isVisibleToRole(roles: AdminRole[] | undefined, role: AdminRole | null) {
  if (!roles || roles.length === 0) return true;
  if (!role) return false;
  return roles.includes(role);
}

function formatRole(role: AdminRole | null) {
  if (role === "super_admin") return "Super Admin";
  if (role === "attendant") return "Attendant";
  return "Admin";
}
