import { createLazyFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, Package, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createLazyFileRoute("/admin")({ component: AdminLayout });

type NavChild = {
  to: string;
  label: string;
};

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Products",
    icon: Package,
    children: [
      { to: "/admin/products/add", label: "Add New Product" },
      { to: "/admin/products/list", label: "Products List" },
    ],
  },
  {
    label: "Catalogue",
    icon: Store,
    children: [
      { to: "/admin/catalogue/add", label: "Add New" },
      { to: "/admin/catalogue/list", label: "List" },
    ],
  },
];

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

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

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-foreground lg:pl-72">
      <AdminSidebar
        path={path}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={() => signOut()}
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

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 shadow-sm sm:flex">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#111111] text-sm font-semibold text-white">
                  {getInitial(user.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111111]">Admin Profile</p>
                  <p className="truncate text-xs text-muted-foreground">Attendant • {user.email}</p>
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
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  path: string;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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
            {NAV_ITEMS.map((item) => (
              <SidebarSubmenu
                key={item.label}
                item={item}
                path={path}
                open={openMenu === item.label}
                onToggle={() => setOpenMenu((current) => (current === item.label ? null : item.label))}
              />
            ))}
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

function SidebarSubmenu({
  item,
  path,
  open,
  onToggle,
}: {
  item: NavItem;
  path: string;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  const children = item.children;
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
