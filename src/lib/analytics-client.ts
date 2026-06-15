type StoredAnalyticsSession = {
  id: string;
  source: string;
  referrer: string | null;
  started_at: string;
};

const SESSION_KEY = "shopict_analytics_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function safeParseSession(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAnalyticsSession;
  } catch {
    return null;
  }
}

function safeReadSessionStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteSessionStorage(key: string, value: string) {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function classifyReferrer(referrer: string, utmSource: string | null) {
  if (utmSource) return utmSource;
  if (!referrer) return "Direct";

  try {
    const hostname = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (hostname.includes("google.")) return "Google";
    if (hostname.includes("bing.") || hostname.includes("yahoo.")) return "Search";
    if (
      hostname.includes("facebook.") ||
      hostname.includes("instagram.") ||
      hostname.includes("tiktok.") ||
      hostname.includes("x.com") ||
      hostname.includes("twitter.")
    ) {
      return "Social";
    }
    if (hostname.includes("whatsapp.")) return "WhatsApp";
    return "Referral";
  } catch {
    return "Referral";
  }
}

function detectDeviceType(userAgent: string) {
  const agent = userAgent.toLowerCase();
  if (/ipad|tablet/.test(agent)) return "Tablet";
  if (/mobi|android|iphone/.test(agent)) return "Mobile";
  return "Desktop";
}

function getAnalyticsSession() {
  if (typeof window === "undefined") return null;

  const current = safeParseSession(safeReadSessionStorage(SESSION_KEY));
  const currentAge = current ? Date.now() - new Date(current.started_at).getTime() : Infinity;

  if (current && currentAge < SESSION_TTL_MS) {
    return current;
  }

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source")?.trim() || null;
  const referrer = document.referrer || null;
  const source = classifyReferrer(referrer ?? "", utmSource);

  const session: StoredAnalyticsSession = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
    source,
    referrer,
    started_at: new Date().toISOString(),
  };

  if (!safeWriteSessionStorage(SESSION_KEY, JSON.stringify(session))) {
    return null;
  }
  return session;
}

export function buildClientAnalyticsPayload(pathname: string) {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;

  const session = getAnalyticsSession();
  if (!session) return null;

  return {
    pathname,
    session_id: session.id,
    source: session.source,
    referrer: session.referrer,
    device_type: detectDeviceType(navigator.userAgent || ""),
    user_agent: navigator.userAgent || "",
    metadata: {
      href: window.location.href,
      search: window.location.search,
    },
  };
}
