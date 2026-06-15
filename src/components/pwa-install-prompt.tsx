import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const INSTALL_STORAGE_KEY = "shop-ict-pwa-installed";
const AUTO_HIDE_MS = 5000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isMobileDevice() {
  return window.matchMedia("(max-width: 767px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIos && isSafari;
}

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const iosSafari = typeof window !== "undefined" && isIosSafari();

  useEffect(() => {
    if (!isMobileDevice() || isStandalone()) return;

    try {
      if (window.localStorage.getItem(INSTALL_STORAGE_KEY) === "true") return;
    } catch {
      // Continue if storage is blocked; install eligibility still governs display.
    }

    const showTimer = window.setTimeout(() => {
      setHiddenByScroll(false);
      setShowPrompt(true);
    }, 400);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setHiddenByScroll(false);
      setShowPrompt(true);
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setShowPrompt(false);
      try {
        window.localStorage.setItem(INSTALL_STORAGE_KEY, "true");
      } catch {
        // Ignore storage access restrictions.
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showPrompt || hiddenByScroll) return;

    const autoHideTimer = window.setTimeout(() => {
      setShowPrompt(false);
    }, AUTO_HIDE_MS);

    const hideOnScroll = () => {
      window.clearTimeout(autoHideTimer);
      setHiddenByScroll(true);
    };
    window.addEventListener("scroll", hideOnScroll, { passive: true, once: true });

    return () => {
      window.clearTimeout(autoHideTimer);
      window.removeEventListener("scroll", hideOnScroll);
    };
  }, [hiddenByScroll, showPrompt]);

  const dismiss = () => {
    setInstallEvent(null);
    setShowPrompt(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setShowPrompt(false);

    if (choice.outcome !== "accepted") {
      dismiss();
    }
  };

  if (!showPrompt || hiddenByScroll) return null;

  return (
    <aside
      role="dialog"
      aria-label="Install Shop ICT Gadgets app"
      className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 w-[calc(100%-1.5rem)] max-w-[320px] overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.18)] md:hidden"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6]"
        aria-label="Dismiss install prompt"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-2.5 pr-7">
        <img src="/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-[7px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-5 text-[#111827]">Install Shop ICT Gadgets</p>
          {installEvent ? (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-[#e30613] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#c70511]"
            >
              <Download className="h-3.5 w-3.5" />
              Install app
            </button>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-[11px] leading-4 text-[#4b5563]">
              {iosSafari ? (
                <>
                  Tap <Share className="inline h-3.5 w-3.5 shrink-0" /> then Add to Home Screen.
                </>
              ) : (
                <>Use your browser menu to add this app to your home screen.</>
              )}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
