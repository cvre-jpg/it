import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, BellRing, CalendarClock, CreditCard, Package } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchWebPushPublicKey,
  listSuperAdminNotifications,
  markSuperAdminNotificationRead,
  removeSuperAdminPushSubscription,
  saveSuperAdminPushSubscription,
} from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { AdminRole } from "@/lib/admin-auth";

export const Route = createFileRoute("/admin/notifications")({ component: AdminNotifications });

function AdminNotifications() {
  const queryClient = useQueryClient();
  const { user, role, isSuperAdmin } = useAuth();
  const [pushState, setPushState] = useState<{
    supported: boolean;
    permission: NotificationPermission | "unsupported";
    subscribed: boolean;
    busy: boolean;
    error: string;
  }>({
    supported: true,
    permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    subscribed: false,
    busy: false,
    error: "",
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["super-admin-notifications"],
    queryFn: () => listSuperAdminNotifications(),
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markSuperAdminNotificationRead(id),
    onSuccess: async (_, id) => {
      queryClient.setQueryData(["super-admin-notifications"], (current: any[] | undefined) =>
        (current ?? []).map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification,
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["super-admin-notifications"] });
    },
  });

  useEffect(() => {
    if (!isSuperAdmin) return;
    void syncPushState(user?.email ?? null, role).then((nextState) => {
      if (!nextState) return;
      setPushState((current) => ({
        ...current,
        ...nextState,
        busy: false,
        error: "",
      }));
    });
  }, [isSuperAdmin, role, user?.email]);

  const enablePhoneAlerts = async () => {
    if (!isSuperAdmin || !user) return;
    setPushState((current) => ({ ...current, busy: true, error: "" }));

    try {
      const subscription = await createOrSyncPushSubscription(user.email, role);
      setPushState({
        supported: true,
        permission: Notification.permission,
        subscribed: Boolean(subscription),
        busy: false,
        error: "",
      });
    } catch (error) {
      setPushState((current) => ({
        ...current,
        supported: "Notification" in window,
        permission: "Notification" in window ? Notification.permission : "unsupported",
        busy: false,
        error: error instanceof Error ? error.message : "Could not enable phone alerts.",
      }));
    }
  };

  const disablePhoneAlerts = async () => {
    if (!isSuperAdmin) return;
    setPushState((current) => ({ ...current, busy: true, error: "" }));

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported on this device.");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSuperAdminPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setPushState((current) => ({
        ...current,
        busy: false,
        subscribed: false,
      }));
    } catch (error) {
      setPushState((current) => ({
        ...current,
        busy: false,
        error: error instanceof Error ? error.message : "Could not disable phone alerts.",
      }));
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
      </header>

      {isSuperAdmin ? (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#111111]">Phone Alerts</h2>
              <p className="text-sm text-[#4B5563]">
                {pushState.permission === "granted" && pushState.subscribed
                  ? "This device is set to receive super admin push notifications."
                  : "Enable push alerts on this device to receive new order notifications in your phone notification bar."}
              </p>
              {pushState.error ? <p className="text-sm text-[#B91C1C]">{pushState.error}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs font-medium text-[#475569]">
                {pushState.permission === "unsupported"
                  ? "Not supported"
                  : pushState.subscribed
                    ? "Enabled"
                    : pushState.permission === "denied"
                      ? "Blocked"
                      : "Not enabled"}
              </span>
              {pushState.subscribed ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={disablePhoneAlerts}
                  disabled={pushState.busy}
                >
                  Disable alerts
                </Button>
              ) : (
                <Button
                  type="button"
                  className="rounded-full bg-[#E30613] text-white hover:bg-[#c70511]"
                  onClick={enablePhoneAlerts}
                  disabled={pushState.busy || pushState.permission === "unsupported"}
                >
                  Enable phone alerts
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="divide-y">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div key={notification.id} className="flex gap-4 px-5 py-4">
                <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFF1F2] text-[#E30613]">
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#111111]">{notification.title}</p>
                    <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
                      {notification.type === "inventory_due"
                        ? "Inventory"
                        : notification.type === "supplier_bill"
                          ? "Bill"
                          : notification.type === "order_created"
                            ? "Order"
                            : notification.type === "stock_takeout_overdue"
                              ? "Take-out reminder"
                              : notification.type === "stock_depleted"
                                ? "Stock depleted"
                              : "Take-out"}
                    </span>
                    {notification.days_until_due != null ? (
                      <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-medium text-[#B45309]">
                        {notification.days_until_due} day{notification.days_until_due === 1 ? "" : "s"} left
                      </span>
                    ) : null}
                    {notification.is_read ? (
                      <span className="rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[11px] font-medium text-[#15803D]">
                        Read
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#4B5563]">{notification.description}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatNotificationMoment(notification)}
                      </span>
                      <span className="capitalize">{String(notification.status).replaceAll("_", " ")}</span>
                    </div>
                    {!notification.is_read ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                      >
                        Mark as read
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-12 text-center text-muted-foreground">
              No notifications right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({
  type,
}: {
  type:
    | "inventory_due"
    | "supplier_bill"
    | "order_created"
    | "stock_takeout"
    | "stock_takeout_overdue"
    | "stock_depleted";
}) {
  if (type === "order_created") return <BellRing className="h-4 w-4" />;
  if (type === "supplier_bill") return <CreditCard className="h-4 w-4" />;
  if (type === "stock_takeout" || type === "stock_takeout_overdue") return <ArrowRightLeft className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNotificationMoment(notification: {
  due_date: string | null;
  created_at?: string | null;
  type: string;
}) {
  if (notification.due_date) return formatDate(notification.due_date);
  if (notification.created_at) return formatDateTime(notification.created_at);
  return notification.type === "order_created" ? "Just now" : "No due date";
}

async function syncPushState(email: string | null, role: AdminRole | null) {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      supported: false,
      permission: "unsupported" as const,
      subscribed: false,
    };
  }

  const registration = await ensureServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && email && role === "super_admin" && Notification.permission === "granted") {
    await saveSuperAdminPushSubscription({
      endpoint: subscription.endpoint,
      keys: getSubscriptionKeys(subscription),
      user_agent: navigator.userAgent,
      device_label: navigator.platform || "Device",
      admin_email: email,
      admin_role: role,
    });
  }

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

async function createOrSyncPushSubscription(email: string, role: AdminRole | null) {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this device.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const { publicKey } = await fetchWebPushPublicKey();
  if (!publicKey) {
    throw new Error("Web push keys are not configured yet.");
  }

  const registration = await ensureServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
  }

  if (role === "super_admin") {
    await saveSuperAdminPushSubscription({
      endpoint: subscription.endpoint,
      keys: getSubscriptionKeys(subscription),
      user_agent: navigator.userAgent,
      device_label: navigator.platform || "Device",
      admin_email: email,
      admin_role: role,
    });
  }

  return subscription;
}

async function ensureServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

function getSubscriptionKeys(subscription: PushSubscription) {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) {
    throw new Error("Push subscription keys are unavailable.");
  }

  return {
    p256dh: arrayBufferToBase64Url(p256dh),
    auth: arrayBufferToBase64Url(auth),
  };
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
