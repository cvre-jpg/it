import { formatKES } from "./format";

export const DEFAULT_WHATSAPP = "+254713869018";
const LAST_VISITED_ROUTE_KEY = "shop-ict:last-route:v1";
const PENDING_RETURN_ROUTE_KEY = "shop-ict:pending-return:v1";
const PENDING_RETURN_TTL = 1000 * 60 * 30;

type PersistedRoute = {
  url: string;
  timestamp: number;
};

export type WaItem = { title: string; quantity: number; price: number };

export function buildWaMessage(items: WaItem[], extra?: string) {
  const lines = items.map((i) => `• ${i.title} x${i.quantity} — ${formatKES(i.price * i.quantity)}`);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return [
    "Hello Shop ICT Gadgets, I would like to order:",
    "",
    ...lines,
    "",
    `Total: ${formatKES(total)}`,
    extra ? "" : undefined,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

export function waLink(number: string, message: string) {
  const num = number.replace(/[^\d]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function inquireSingle(number: string, title: string, price: number) {
  return waLink(number, buildWaMessage([{ title, quantity: 1, price }]));
}

function getCurrentAppUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

function safeReadLocalStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

function writePersistedRoute(key: string, url: string) {
  if (typeof window === "undefined") return;

  try {
    const value: PersistedRoute = {
      url,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors.
  }
}

function readPersistedRoute(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = safeReadLocalStorage(key);
    if (!raw) return null;

    const value = JSON.parse(raw) as PersistedRoute;
    if (!value?.url || !value?.timestamp) return null;
    return value;
  } catch {
    safeRemoveLocalStorage(key);
    return null;
  }
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;

  const iosStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const displayModeStandalone = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || displayModeStandalone;
}

export function persistLastVisitedRoute(url = getCurrentAppUrl()) {
  writePersistedRoute(LAST_VISITED_ROUTE_KEY, url);
}

export function markPendingExternalReturn(url = getCurrentAppUrl()) {
  persistLastVisitedRoute(url);
  writePersistedRoute(PENDING_RETURN_ROUTE_KEY, url);
}

export function consumePendingExternalReturn(currentUrl = getCurrentAppUrl()) {
  if (typeof window === "undefined") return null;

  const pending = readPersistedRoute(PENDING_RETURN_ROUTE_KEY);
  if (!pending) return null;

  safeRemoveLocalStorage(PENDING_RETURN_ROUTE_KEY);

  if (!isStandalonePwa()) return null;
  if (currentUrl !== "/" && currentUrl !== "/index.html") return null;
  if (Date.now() - pending.timestamp > PENDING_RETURN_TTL) return null;
  if (!pending.url || pending.url === "/" || pending.url === currentUrl) return null;

  return pending.url;
}

export function openWhatsAppConversation(url: string) {
  if (typeof window === "undefined") return;

  markPendingExternalReturn();

  if (isStandalonePwa()) {
    window.location.assign(url);
    return;
  }

  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(url);
  }
}

type WhatsAppClickEvent = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  metaKey: boolean;
  preventDefault: () => void;
  shiftKey: boolean;
};

export function handleWhatsAppLinkClick(event: WhatsAppClickEvent, url: string) {
  if (event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  openWhatsAppConversation(url);
}
