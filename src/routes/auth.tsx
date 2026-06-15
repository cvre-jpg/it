import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getAdminAccessConfig, verifyAdminAccessCode } from "@/lib/admin-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Login - Shop ICT Gadgets" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

const ACCESS_STORAGE_KEY = "shopict_admin_access_granted";
const ACCESS_TTL_MS = 5 * 24 * 60 * 60 * 1000;

function readStoredAccess(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    if (!raw) return null;
    if (raw === "1") return "1";

    const parsed = JSON.parse(raw) as { granted?: boolean; expiresAt?: number };
    if (parsed.granted && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now()) {
      return "1";
    }

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

function writeStoredAccess(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        granted: true,
        expiresAt: Date.now() + ACCESS_TTL_MS,
      }),
    );
  } catch {
    // Ignore storage permission and quota issues.
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessGateEnabled, setAccessGateEnabled] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);

  if (user) {
    setTimeout(() => navigate({ to: "/admin" }), 0);
  }

  useEffect(() => {
    let cancelled = false;

    const loadAccessConfig = async () => {
      try {
        const config = await getAdminAccessConfig();
        if (cancelled) return;

        const alreadyGranted = readStoredAccess(ACCESS_STORAGE_KEY) === "1";

        setAccessGateEnabled(Boolean(config.enabled));
        setAccessGranted(!config.enabled || alreadyGranted);
      } catch {
        if (cancelled) return;
        setAccessGateEnabled(false);
        setAccessGranted(true);
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    };

    void loadAccessConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const submitAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await verifyAdminAccessCode(accessCode);
      if (!result.valid) {
        throw new Error("Invalid private access code");
      }

      writeStoredAccess(ACCESS_STORAGE_KEY);

      setAccessGranted(true);
      setAccessCode("");
      toast.success("Private access unlocked");
    } catch (err: any) {
      toast.error(err.message || "Private access denied");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Admin access granted");
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err.message || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden gradient-dark p-12 text-white lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground font-bold">S</span>
          Shop ICT Gadgets
        </Link>
        <div className="my-auto">
          <h2 className="text-4xl font-bold leading-tight">Store admin access.</h2>
          <p className="mt-4 max-w-md text-white/70">
            Sign in with your dashboard credentials to manage the sections assigned to your role.
          </p>
        </div>
      </aside>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 font-semibold lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground font-bold">S</span>
            Shop ICT Gadgets
          </Link>
          <h1 className="text-3xl font-bold">Admin login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {accessGateEnabled && !accessGranted
              ? "Enter your private access code first."
              : "Use your configured dashboard email and password."}
          </p>

          {accessLoading ? (
            <div className="mt-8 rounded-2xl border bg-card px-4 py-5 text-sm text-muted-foreground">
              Loading secure access...
            </div>
          ) : accessGateEnabled && !accessGranted ? (
            <form onSubmit={submitAccessCode} className="mt-8 space-y-4">
              <input
                type="password"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Private access code"
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button disabled={loading} type="submit" size="lg" className="w-full rounded-full">
                {loading ? "Checking..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <Button disabled={loading} type="submit" size="lg" className="w-full rounded-full">
                {loading ? "Please wait..." : "Sign in"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
