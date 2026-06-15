import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchHomepageData, fetchShopProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { absoluteUrl, buildMetaDescription, buildTitle } from "@/lib/seo";
import { buildResponsiveImageAttrs, optimizeImageUrl } from "@/lib/images";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: buildTitle("Premium Electronics in Kenya") },
      {
        name: "description",
        content: buildMetaDescription(
          "Shop laptops, smartphones, monitors, printers, networking gear, CCTV and accessories from Shop ICT Gadgets in Kenya.",
          "Shop premium electronics in Kenya.",
        ),
      },
      { property: "og:title", content: buildTitle("Premium Electronics in Kenya") },
      {
        property: "og:description",
        content: "Shop laptops, smartphones, monitors, printers, networking gear, CCTV and accessories from Shop ICT Gadgets in Kenya.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { property: "og:image", content: absoluteUrl("/logo.png") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: buildTitle("Premium Electronics in Kenya") },
      {
        name: "twitter:description",
        content: "Shop laptops, smartphones, monitors, printers, networking gear, CCTV and accessories from Shop ICT Gadgets in Kenya.",
      },
      { name: "twitter:image", content: absoluteUrl("/logo.png") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
  }),
  component: HomePage,
});

function resolveBannerUrl(url: string) {
  const value = String(url ?? "").trim();
  if (!value) return "/shop";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function getBestDealsCardWidthRatio(viewportWidth: number) {
  if (viewportWidth >= 1280) return 0.2;
  if (viewportWidth >= 1024) return 0.25;
  return 0.5;
}

type HomepageTab = {
  label: string;
  mobileLabel?: string;
  subcategory?: string;
  sortBy?: "popular" | "price-asc";
};

const LAPTOP_TABS: HomepageTab[] = [
  { label: "All" },
  { label: "Brand New", mobileLabel: "New", subcategory: "Brand New Laptops" },
  { label: "Gaming", mobileLabel: "Game", subcategory: "Gaming Laptops" },
  { label: "Ex-UK", subcategory: "Ex-UK Laptops" },
  { label: "Budget Friendly", mobileLabel: "Budget", sortBy: "price-asc" },
];

const MONITOR_TABS: HomepageTab[] = [
  { label: "All" },
  { label: "Brand New", mobileLabel: "New", subcategory: "Brand New Monitors" },
  { label: "Gaming", mobileLabel: "Game", subcategory: "Gaming Monitors" },
  { label: "Ex-UK", subcategory: "Ex-UK Monitors" },
];

const AUDIO_TABS: HomepageTab[] = [
  { label: "All" },
  { label: "Speakers", subcategory: "Bluetooth Speakers" },
  { label: "Soundbars", subcategory: "Soundbars" },
  { label: "Earbuds", subcategory: "Wireless Earbuds" },
];

const SMARTPHONE_TABS: HomepageTab[] = [
  { label: "All" },
  { label: "iPhone", subcategory: "iPhones" },
  { label: "Samsung", subcategory: "Samsung Phones" },
  { label: "Android", subcategory: "Android Phones" },
];

const PRINTER_TABS: HomepageTab[] = [
  { label: "All" },
  { label: "Inkjet", subcategory: "Inkjet Printers" },
  { label: "Laser", subcategory: "Laser Printers" },
];

const HOMEPAGE_CATEGORY_MOBILE_LIMIT = 10;
const HOMEPAGE_CATEGORY_DESKTOP_LIMIT = 20;

function HomepageTabs({
  options,
  activeLabel,
  onSelect,
}: {
  options: HomepageTab[];
  activeLabel: string;
  onSelect: (label: string) => void;
}) {
  return (
    <div
      className="flex w-full max-w-full flex-nowrap items-center gap-px rounded-[12px] bg-[#f2f4f7] p-0.5 md:w-auto md:flex-wrap md:gap-1 md:rounded-full md:p-1"
      role="tablist"
      aria-label="Subcategories"
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          role="tab"
          aria-selected={activeLabel === option.label}
          onClick={() => onSelect(option.label)}
          className={`min-w-0 flex-1 basis-0 shrink rounded-full border px-0.5 py-1.5 text-[9px] font-semibold leading-none transition-colors min-[360px]:text-[10px] sm:text-xs md:flex-none md:basis-auto md:px-3 md:font-medium md:leading-normal ${
            activeLabel === option.label
              ? "border-[#E30613] bg-[#fdecee] text-[#E30613]"
              : "border-transparent text-muted-foreground hover:bg-white hover:text-foreground"
          }`}
        >
          <span className="block whitespace-nowrap md:hidden">{option.mobileLabel ?? option.label}</span>
          <span className="hidden whitespace-nowrap md:block">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function HomePage() {
  const {
    data: homepageData,
    isLoading: homepageDataLoading,
    isError: homepageDataError,
    error: homepageDataErrorDetails,
  } = useQuery({
    queryKey: ["homepage-data"],
    queryFn: () => fetchHomepageData(),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
  const [activeLaptopTab, setActiveLaptopTab] = useState(LAPTOP_TABS[0].label);
  const [activeMonitorTab, setActiveMonitorTab] = useState(MONITOR_TABS[0].label);
  const [activeAudioTab, setActiveAudioTab] = useState(AUDIO_TABS[0].label);
  const [activeSmartphoneTab, setActiveSmartphoneTab] = useState(SMARTPHONE_TABS[0].label);
  const [activePrinterTab, setActivePrinterTab] = useState(PRINTER_TABS[0].label);
  const selectedLaptopTab = LAPTOP_TABS.find((tab) => tab.label === activeLaptopTab) ?? LAPTOP_TABS[0];
  const selectedMonitorTab = MONITOR_TABS.find((tab) => tab.label === activeMonitorTab) ?? MONITOR_TABS[0];
  const selectedAudioTab = AUDIO_TABS.find((tab) => tab.label === activeAudioTab) ?? AUDIO_TABS[0];
  const selectedSmartphoneTab =
    SMARTPHONE_TABS.find((tab) => tab.label === activeSmartphoneTab) ?? SMARTPHONE_TABS[0];
  const selectedPrinterTab = PRINTER_TABS.find((tab) => tab.label === activePrinterTab) ?? PRINTER_TABS[0];
  const {
    data: desktopLaptopResult,
    isLoading: desktopLaptopOverrideLoading,
    isError: desktopLaptopsError,
  } = useQuery({
    queryKey: ["homepage-tabs", "laptops", activeLaptopTab, HOMEPAGE_CATEGORY_DESKTOP_LIMIT],
    queryFn: () =>
      fetchShopProducts({
        categorySlug: "laptops",
        subcategory: selectedLaptopTab.subcategory,
        sortBy: selectedLaptopTab.sortBy ?? "popular",
        pageSize: HOMEPAGE_CATEGORY_DESKTOP_LIMIT,
      }),
    enabled: activeLaptopTab !== LAPTOP_TABS[0].label,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
  const {
    data: desktopMonitorResult,
    isLoading: desktopMonitorOverrideLoading,
    isError: desktopMonitorsError,
  } = useQuery({
    queryKey: ["homepage-tabs", "monitors", activeMonitorTab, HOMEPAGE_CATEGORY_DESKTOP_LIMIT],
    queryFn: () =>
      fetchShopProducts({
        categorySlug: "monitors",
        subcategory: selectedMonitorTab.subcategory,
        sortBy: "popular",
        pageSize: HOMEPAGE_CATEGORY_DESKTOP_LIMIT,
      }),
    enabled: activeMonitorTab !== MONITOR_TABS[0].label,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
  const {
    data: desktopSmartphoneResult,
    isLoading: desktopSmartphoneOverrideLoading,
    isError: desktopSmartphonesError,
  } = useQuery({
    queryKey: ["homepage-tabs", "smartphones", activeSmartphoneTab, HOMEPAGE_CATEGORY_DESKTOP_LIMIT],
    queryFn: () =>
      fetchShopProducts({
        categorySlug: "smartphones",
        subcategory: selectedSmartphoneTab.subcategory,
        sortBy: "popular",
        pageSize: HOMEPAGE_CATEGORY_DESKTOP_LIMIT,
      }),
    enabled: activeSmartphoneTab !== SMARTPHONE_TABS[0].label,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
  const {
    data: desktopAudioResult,
    isLoading: desktopAudioOverrideLoading,
    isError: desktopAudioError,
  } = useQuery({
    queryKey: ["homepage-tabs", "audio", activeAudioTab, HOMEPAGE_CATEGORY_DESKTOP_LIMIT],
    queryFn: () =>
      fetchShopProducts({
        categorySlug: "audio",
        subcategory: selectedAudioTab.subcategory,
        sortBy: "popular",
        pageSize: HOMEPAGE_CATEGORY_DESKTOP_LIMIT,
      }),
    enabled: activeAudioTab !== AUDIO_TABS[0].label,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
  const {
    data: desktopPrinterResult,
    isLoading: desktopPrinterOverrideLoading,
    isError: desktopPrintersError,
  } = useQuery({
    queryKey: ["homepage-tabs", "printers", activePrinterTab, HOMEPAGE_CATEGORY_DESKTOP_LIMIT],
    queryFn: () =>
      fetchShopProducts({
        categorySlug: "printers",
        subcategory: selectedPrinterTab.subcategory,
        sortBy: "popular",
        pageSize: HOMEPAGE_CATEGORY_DESKTOP_LIMIT,
      }),
    enabled: activePrinterTab !== PRINTER_TABS[0].label,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
  const waNumber = homepageData?.whatsappNumber ?? DEFAULT_WHATSAPP_NUMBER;
  const featured = homepageData?.featured ?? [];
  const homepageBanners = homepageData?.homepageBanners;
  const featuredLoading = homepageDataLoading;
  const featuredError = homepageDataError;
  const featuredErrorDetails = homepageDataErrorDetails;
  const homepageBannersLoading = homepageDataLoading;
  const desktopLaptopsLoading = activeLaptopTab === LAPTOP_TABS[0].label ? homepageDataLoading : desktopLaptopOverrideLoading;
  const desktopMonitorsLoading = activeMonitorTab === MONITOR_TABS[0].label ? homepageDataLoading : desktopMonitorOverrideLoading;
  const desktopSmartphonesLoading =
    activeSmartphoneTab === SMARTPHONE_TABS[0].label ? homepageDataLoading : desktopSmartphoneOverrideLoading;
  const desktopAudioLoading = activeAudioTab === AUDIO_TABS[0].label ? homepageDataLoading : desktopAudioOverrideLoading;
  const desktopPrintersLoading =
    activePrinterTab === PRINTER_TABS[0].label ? homepageDataLoading : desktopPrinterOverrideLoading;
  const desktopLaptops =
    (activeLaptopTab === LAPTOP_TABS[0].label ? homepageData?.sections.laptops : desktopLaptopResult)?.products ?? [];
  const desktopMonitors =
    (activeMonitorTab === MONITOR_TABS[0].label ? homepageData?.sections.monitors : desktopMonitorResult)?.products ?? [];
  const desktopSmartphones =
    (activeSmartphoneTab === SMARTPHONE_TABS[0].label ? homepageData?.sections.smartphones : desktopSmartphoneResult)?.products ?? [];
  const desktopAudio =
    (activeAudioTab === AUDIO_TABS[0].label ? homepageData?.sections.audio : desktopAudioResult)?.products ?? [];
  const desktopPrinters =
    (activePrinterTab === PRINTER_TABS[0].label ? homepageData?.sections.printers : desktopPrinterResult)?.products ?? [];
  const laptops = desktopLaptops;
  const monitors = desktopMonitors;
  const phones = desktopSmartphones;
  const audio = desktopAudio;
  const printers = desktopPrinters;
  const laptopsLoading = desktopLaptopsLoading;
  const monitorsLoading = desktopMonitorsLoading;
  const phonesLoading = desktopSmartphonesLoading;
  const audioLoading = desktopAudioLoading;
  const printersLoading = desktopPrintersLoading;
  const laptopsError = desktopLaptopsError;
  const monitorsError = desktopMonitorsError;
  const phonesError = desktopSmartphonesError;
  const audioError = desktopAudioError;
  const printersError = desktopPrintersError;
  const [featuredEmblaRef, featuredEmblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: true,
    slidesToScroll: 1,
  });
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [activePopularBannerSlide, setActivePopularBannerSlide] = useState(0);
  const [bestDealsCardSize, setBestDealsCardSize] = useState<{ width: number; height: number } | null>(null);
  const [isBestDealsCardStable, setIsBestDealsCardStable] = useState(false);
  const [loadedRightBannerImages, setLoadedRightBannerImages] = useState<Record<string, boolean>>({});
  const [loadedPopularBannerImages, setLoadedPopularBannerImages] = useState<Record<string, boolean>>({});
  const bestDealsSectionRef = useRef<HTMLDivElement | null>(null);
  const initialScrollResetDone = useRef(false);
  const bestDealsCardSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isBestDealsCardStableRef = useRef(false);

  useEffect(() => {
    if (!featuredEmblaApi) return;

    const autoplay = window.setInterval(() => {
      featuredEmblaApi.scrollNext();
    }, 5000);

    return () => window.clearInterval(autoplay);
  }, [featuredEmblaApi]);

  const heroPrimaryProduct = featured[0] ?? laptops[0] ?? phones[0] ?? monitors[0] ?? audio[0] ?? printers[0] ?? null;
  const heroPrimaryImage = heroPrimaryProduct?.images?.[0] ?? null;
  const defaultHeroSlides = [
    {
      title: "Smart deals on premium gadgets",
      description: "Shop laptops, phones and accessories picked for modern everyday performance.",
      image: heroPrimaryImage,
      imageAlt: heroPrimaryProduct?.title ?? "Featured gadget",
      url: "/shop",
      ctaLabel: "Shop now",
      accent: "drop-shadow-[0_18px_24px_rgba(37,99,235,0.18)]",
    },
    {
      title: "Fresh laptop picks for work and gaming",
      description: "Discover powerful portable setups with clean performance and reliable battery life.",
      image: laptops[0]?.images?.[0] ?? featured[2]?.images?.[0] ?? heroPrimaryImage,
      imageAlt: laptops[0]?.title ?? featured[2]?.title ?? "Laptop deal",
      url: "/shop?category=laptops",
      ctaLabel: "Shop now",
      accent: "drop-shadow-[0_18px_24px_rgba(99,102,241,0.18)]",
    },
    {
      title: "Top phone offers built for everyday speed",
      description: "Explore stylish smartphones and mobile essentials at compact ecommerce prices.",
      image: phones[0]?.images?.[0] ?? featured[3]?.images?.[0] ?? heroPrimaryImage,
      imageAlt: phones[0]?.title ?? featured[3]?.title ?? "Phone deal",
      url: "/shop?category=smartphones",
      ctaLabel: "Shop now",
      accent: "drop-shadow-[0_18px_24px_rgba(14,165,233,0.18)]",
    },
  ] as const;
  const savedHeroSlides = (homepageBanners?.heroSlides ?? []).slice(0, 3);
  const heroSlides = defaultHeroSlides.map((slide, index) => ({
    ...slide,
    ...(savedHeroSlides[index] ?? {}),
    imageAlt: savedHeroSlides[index]?.title || slide.imageAlt,
  }));
  const rightBanner = homepageBanners?.rightBanner ?? { image: "", url: "" };
  const rightBannerImage = String(rightBanner.image ?? "").trim();
  const popularBanners = (homepageBanners?.popularBanners ?? []).filter((banner) => banner.image || banner.url).slice(0, 2);
  const activePopularBanner = popularBanners[activePopularBannerSlide] ?? popularBanners[0] ?? { image: "", url: "" };
  const activePopularBannerImage = String(activePopularBanner.image ?? "").trim();
  const activeHero = heroSlides[activeHeroSlide] ?? heroSlides[0];
  const heroImageAttrs = buildResponsiveImageAttrs(activeHero.image, {
    width: 760,
    height: 360,
    mode: "fit",
    widths: [320, 480, 640, 760],
    sizes: "(max-width: 767px) 42vw, (max-width: 1279px) 36vw, 320px",
    quality: "q_auto:eco",
  });
  const rightBannerAttrs = buildResponsiveImageAttrs(rightBannerImage, {
    width: 1080,
    height: 376,
    widths: [540, 720, 960, 1080],
    sizes: "(min-width: 768px) 540px, 100vw",
    quality: "q_auto:eco",
  });
  const popularBannerAttrs = buildResponsiveImageAttrs(activePopularBanner.image, {
    width: 520,
    height: 760,
    widths: [260, 360, 420, 520],
    sizes: "(max-width: 767px) 92vw, 320px",
    quality: "q_auto:eco",
  });
  const shouldShowRightBannerSkeleton =
    homepageBannersLoading || (Boolean(rightBannerImage) && loadedRightBannerImages[rightBannerImage] !== true);
  const isRightBannerReady = Boolean(rightBannerImage) && !shouldShowRightBannerSkeleton;

  useEffect(() => {
    const autoplay = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 10000);

    return () => window.clearInterval(autoplay);
  }, [heroSlides.length]);

  useEffect(() => {
    if (popularBanners.length <= 1) {
      setActivePopularBannerSlide(0);
      return;
    }

    const autoplay = window.setInterval(() => {
      setActivePopularBannerSlide((current) => (current + 1) % popularBanners.length);
    }, 5000);

    return () => window.clearInterval(autoplay);
  }, [popularBanners.length]);

  useEffect(() => {
    if (popularBanners.length === 0) {
      setActivePopularBannerSlide(0);
      return;
    }

    setActivePopularBannerSlide((current) => Math.min(current, popularBanners.length - 1));
  }, [popularBanners.length]);

  useEffect(() => {
    if (typeof window === "undefined" || !rightBannerImage || loadedRightBannerImages[rightBannerImage]) return;

    const image = new window.Image();
    const markLoaded = () => {
      setLoadedRightBannerImages((current) =>
        current[rightBannerImage] ? current : { ...current, [rightBannerImage]: true },
      );
    };

    image.onload = markLoaded;
    image.onerror = markLoaded;
    image.src = optimizeImageUrl(rightBannerImage, { width: 1080, height: 376 });

    if (image.complete) {
      markLoaded();
    }
  }, [loadedRightBannerImages, rightBannerImage]);

  useEffect(() => {
    if (typeof window === "undefined" || popularBanners.length === 0) return;

    for (const banner of popularBanners) {
      const src = String(banner.image ?? "").trim();
      if (!src || loadedPopularBannerImages[src]) continue;

      const image = new window.Image();
      const markLoaded = () => {
        setLoadedPopularBannerImages((current) => (current[src] ? current : { ...current, [src]: true }));
      };

      image.onload = markLoaded;
      image.onerror = markLoaded;
      image.src = optimizeImageUrl(src, { width: 520, height: 760 });

      if (image.complete) {
        markLoaded();
      }
    }
  }, [loadedPopularBannerImages, popularBanners]);

  useLayoutEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let stabilityTimeout: number | null = null;

    const setStable = (next: boolean) => {
      if (isBestDealsCardStableRef.current === next) return false;
      isBestDealsCardStableRef.current = next;
      setIsBestDealsCardStable(next);
      return true;
    };

    const setCardSize = (next: { width: number; height: number } | null) => {
      const current = bestDealsCardSizeRef.current;
      const unchanged =
        (current === null && next === null) ||
        (current !== null &&
          next !== null &&
          current.width === next.width &&
          current.height === next.height);

      if (unchanged) return false;

      bestDealsCardSizeRef.current = next;
      setBestDealsCardSize(next);
      return true;
    };

    const scheduleStableState = () => {
      setStable(false);
      if (stabilityTimeout !== null) {
        window.clearTimeout(stabilityTimeout);
      }

      // Keep the skeleton visible until the reference card stops resizing.
      stabilityTimeout = window.setTimeout(() => {
        setStable(true);
      }, 120);
    };

    const measure = () => {
      if (typeof window === "undefined") return;

      if (window.innerWidth < 768) {
        setCardSize(null);
        setStable(false);
        return;
      }

      const section = bestDealsSectionRef.current;
      const card = bestDealsSectionRef.current?.querySelector<HTMLElement>("[data-best-deals-card='true']");
      if (!section || !card) {
        setCardSize(null);
        setStable(false);
        return;
      }

      const rect = card.getBoundingClientRect();
      const gap = 16;
      const sectionWidth = Math.round(section.getBoundingClientRect().width);
      const widthRatio = getBestDealsCardWidthRatio(window.innerWidth);
      const nextSize = {
        width: Math.round((widthRatio * Math.max(0, sectionWidth - gap)) / (1 + widthRatio)),
        height: Math.round(rect.height),
      };
      const sizeChanged = setCardSize(nextSize);
      if (sizeChanged) {
        scheduleStableState();
      }

      if (!resizeObserver && typeof window.ResizeObserver !== "undefined") {
        resizeObserver = new window.ResizeObserver(() => {
          const nextRect = card.getBoundingClientRect();
          const nextSectionWidth = Math.round(section.getBoundingClientRect().width);
          const nextWidthRatio = getBestDealsCardWidthRatio(window.innerWidth);
          const nextSize = {
            width: Math.round((nextWidthRatio * Math.max(0, nextSectionWidth - gap)) / (1 + nextWidthRatio)),
            height: Math.round(nextRect.height),
          };
          const sizeChanged = setCardSize(nextSize);
          if (sizeChanged) {
            scheduleStableState();
          }
        });
        resizeObserver.observe(card);
        resizeObserver.observe(section);
      }
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
      if (stabilityTimeout !== null) {
        window.clearTimeout(stabilityTimeout);
      }
    };
  }, [featured.length]);

  const storefrontSettled =
    !featuredLoading && !laptopsLoading && !phonesLoading && !monitorsLoading && !audioLoading && !printersLoading;
  const shouldShowBestDealSkeletons = featuredLoading || (!featuredError && featured.length === 0);
  const shouldShowDesktopBestDealsBannerSkeleton =
    homepageBannersLoading ||
    (Boolean(activePopularBannerImage) &&
      (!bestDealsCardSize ||
        !isBestDealsCardStable ||
        loadedPopularBannerImages[activePopularBannerImage] !== true));
  const mobileLaptops = desktopLaptops.slice(0, HOMEPAGE_CATEGORY_MOBILE_LIMIT);
  const mobileMonitors = desktopMonitors.slice(0, HOMEPAGE_CATEGORY_MOBILE_LIMIT);
  const mobileSmartphones = desktopSmartphones.slice(0, HOMEPAGE_CATEGORY_MOBILE_LIMIT);
  const mobileAudio = desktopAudio.slice(0, HOMEPAGE_CATEGORY_MOBILE_LIMIT);
  const mobilePrinters = desktopPrinters.slice(0, HOMEPAGE_CATEGORY_MOBILE_LIMIT);

  useEffect(() => {
    if (initialScrollResetDone.current || !storefrontSettled || typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    initialScrollResetDone.current = true;
  }, [storefrontSettled]);

  return (
    <div className="animate-fade-in">
      <section className="site-desktop-width mx-auto w-full px-3 pt-2.5 md:px-5 xl:px-6">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_540px]">
          <article className="group relative h-[172px] overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#e7f3ff_0%,#cfe6ff_48%,#b7d4ff_100%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] md:h-[188px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(255,255,255,0.65),transparent_30%),radial-gradient(circle_at_68%_78%,rgba(72,127,255,0.14),transparent_34%)]" />
            <div
              key={`hero-slide-${activeHeroSlide}-${activeHero.image ?? ""}`}
              className="relative flex h-full animate-fade-in items-center justify-between gap-2 p-3 sm:gap-3 sm:p-[18px]"
            >
              <div className="min-w-0 max-w-[54%] sm:max-w-[52%]">
                <h1 className="mb-1 text-[16px] font-bold leading-[1.12] text-[#111111] sm:mb-1.5 sm:text-[22px] md:text-[24px]">
                  {activeHero.title}
                </h1>
                <p className="mb-1.5 text-[10px] leading-[1.3] text-[#4B5563] sm:mb-2.5 sm:text-[13px] sm:leading-[1.4]">
                  {activeHero.description}
                </p>
                <Button
                  asChild
                  className="mt-1 h-auto rounded-[7px] bg-[#E30613] px-2.5 py-1 text-[10px] font-semibold text-white shadow-none transition-colors hover:bg-[#c70511] sm:mt-2 sm:px-[14px] sm:py-2 sm:text-[13px]"
                >
                  <a href={resolveBannerUrl(activeHero.url)}>{activeHero.ctaLabel || "Shop now"}</a>
                </Button>
              </div>

              <div className="relative flex min-w-0 flex-[0_0_42%] items-center justify-end self-stretch">
                {activeHero.image ? (
                  <img
                    src={heroImageAttrs.src}
                    srcSet={heroImageAttrs.srcSet}
                    sizes={heroImageAttrs.sizes}
                    alt={activeHero.imageAlt}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className={`h-[78%] w-auto max-w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.03] sm:h-[84%] md:translate-x-[-12px] ${activeHero.accent}`}
                  />
                ) : null}
              </div>
            </div>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 md:bottom-4 md:gap-1.5">
              {heroSlides.map((_, index) => (
                <button
                  key={`hero-${index}`}
                  type="button"
                  aria-label={`Show hero slide ${index + 1}`}
                  onClick={() => setActiveHeroSlide(index)}
                  className={`rounded-full transition-all ${activeHeroSlide === index ? "h-1.5 w-4 bg-[#E30613] md:w-5" : "h-1.5 w-1.5 bg-[#94a3b8] md:w-2"}`}
                />
              ))}
            </div>
          </article>

          <article className="relative hidden h-[172px] overflow-hidden rounded-[10px] bg-muted/20 md:block md:h-[188px] md:w-[540px]">
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                shouldShowRightBannerSkeleton ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <Skeleton className="h-full w-full rounded-[10px]" />
            </div>
            {rightBannerImage ? (
              <a
                href={resolveBannerUrl(rightBanner.url)}
                className={`absolute inset-0 block h-full w-full overflow-hidden rounded-[10px] transition-opacity duration-700 ease-out ${
                  isRightBannerReady ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src={rightBannerAttrs.src}
                  srcSet={rightBannerAttrs.srcSet}
                  sizes={rightBannerAttrs.sizes}
                  alt="Homepage promo banner"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className={`h-full w-full object-cover transition-opacity duration-700 ease-out ${
                    isRightBannerReady ? "opacity-100" : "opacity-0"
                  }`}
                />
              </a>
            ) : null}
          </article>
        </div>
      </section>

      <section className="site-desktop-width mx-auto px-6 py-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold leading-none tracking-tight md:text-3xl">Best deals</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => featuredEmblaApi?.scrollPrev()}
              aria-label="Previous featured products"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={() => featuredEmblaApi?.scrollNext()}
              aria-label="Next featured products"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
            </button>
            <Link to="/shop" className="hidden text-sm font-medium text-primary hover:underline md:inline">
              <span className="inline-flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
        {featuredError ? (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Could not load featured products. {featuredErrorDetails instanceof Error ? featuredErrorDetails.message : "Please check the database connection and try again."}
          </div>
        ) : null}
        <div className="md:flex md:gap-4" ref={bestDealsSectionRef}>
          {shouldShowDesktopBestDealsBannerSkeleton ? (
            <div
              className="hidden min-w-0 md:block md:flex-none"
              style={bestDealsCardSize ? { width: `${bestDealsCardSize.width}px` } : undefined}
            >
              <div className="space-y-3">
                <Skeleton
                  className="rounded-xl"
                  style={bestDealsCardSize ? { height: `${bestDealsCardSize.height}px` } : { height: "420px" }}
                />
                <div className="flex items-center justify-center gap-1.5">
                  <Skeleton className="h-2 w-5 rounded-full" />
                  <Skeleton className="h-2 w-2 rounded-full" />
                </div>
              </div>
            </div>
          ) : null}
          {!shouldShowDesktopBestDealsBannerSkeleton && activePopularBannerImage ? (
            <div
              className="hidden min-w-0 md:block md:flex-none"
              style={bestDealsCardSize ? { width: `${bestDealsCardSize.width}px` } : undefined}
            >
              <div className="space-y-3">
                <div
                  className="overflow-hidden rounded-xl"
                  style={bestDealsCardSize ? { height: `${bestDealsCardSize.height}px` } : undefined}
                >
                  <a
                    key={`best-deals-banner-active-${activePopularBannerSlide}`}
                    href={resolveBannerUrl(activePopularBanner.url)}
                    className="group relative block h-full w-full animate-fade-in overflow-hidden rounded-xl transition duration-200 ease-[ease] hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <img
                      src={popularBannerAttrs.src}
                      srcSet={popularBannerAttrs.srcSet}
                      sizes={popularBannerAttrs.sizes}
                      alt={`Best deals banner ${activePopularBannerSlide + 1}`}
                      loading="eager"
                      decoding="async"
                      className="h-full w-full object-cover object-center transition-transform duration-200 ease-[ease] group-hover:scale-[1.02]"
                    />
                  </a>
                </div>
                {popularBanners.length > 1 ? (
                  <div className="flex items-center justify-center gap-1.5">
                    {popularBanners.map((_, index) => (
                      <button
                        key={`best-deals-banner-${index}`}
                        type="button"
                        aria-label={`Show best deals banner ${index + 1}`}
                        onClick={() => setActivePopularBannerSlide(index)}
                        className={`rounded-full transition-all ${
                          activePopularBannerSlide === index ? "h-2 w-5 bg-[#E30613]" : "h-2 w-2 bg-[#CBD5E1]"
                        }`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="min-w-0 md:flex-1">
            <div className="overflow-hidden" ref={featuredEmblaRef}>
              <div className="-ml-4 flex">
                {shouldShowBestDealSkeletons ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={`featured-skeleton-${index}`}
                      data-best-deals-card="true"
                      className="min-w-0 pl-4 flex-[0_0_68%] sm:flex-[0_0_50%] lg:flex-[0_0_25%] xl:flex-[0_0_20%]"
                    >
                      <div className="flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] sm:rounded-xl sm:border sm:bg-card sm:p-[4px] sm:shadow-none">
                        <Skeleton className="h-[220px] w-full sm:aspect-square sm:h-auto sm:rounded-[calc(theme(borderRadius.xl)-4px)]" />
                        <div className="space-y-2 px-[4px] pb-[10px] pt-2 sm:mt-1.5 sm:px-[1px] sm:pb-[1px] sm:pt-0">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : null}
                {featured.map((p) => (
                  <div
                    key={p.id}
                    data-best-deals-card="true"
                    className="min-w-0 pl-4 flex-[0_0_68%] sm:flex-[0_0_50%] lg:flex-[0_0_25%] xl:flex-[0_0_20%]"
                  >
                    <ProductCard product={p} whatsAppNumber={waNumber} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {!laptopsLoading && !laptopsError && laptops.length > 0 && (
        <section className="site-desktop-width mx-auto px-1 py-10 md:px-6">
          <div className="mb-5 space-y-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <div className="flex items-center justify-between gap-4 md:hidden">
              <h2 className="text-2xl font-bold leading-none">Laptops</h2>
              <Link to="/shop" search={{ category: "Laptops" } as any} className="text-sm font-medium text-primary hover:underline">
                <span className="inline-flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <h2 className="hidden text-2xl font-bold leading-none md:block md:text-3xl">Laptops</h2>
              <HomepageTabs options={LAPTOP_TABS} activeLabel={activeLaptopTab} onSelect={setActiveLaptopTab} />
            </div>
            <Link to="/shop" search={{ category: "Laptops" } as any} className="hidden text-sm font-medium text-primary hover:underline md:inline">
              <span className="inline-flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 md:hidden">
              {mobileLaptops.map((p, index) => (
                index === 3 && (homepageBannersLoading || activePopularBanner.image) ? (
                  <div key={p.id} className="contents">
                  <a
                    href={homepageBannersLoading ? "/shop" : resolveBannerUrl(activePopularBanner.url)}
                    className={`relative mb-3 block h-full w-full overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] md:hidden ${
                      homepageBannersLoading ? "" : "group transition duration-200 ease-[ease] hover:-translate-y-0.5 active:scale-[0.98]"
                    }`}
                  >
                    <div className="relative h-full min-h-[220px] w-full overflow-hidden bg-[#F5F5F5]">
                      {homepageBannersLoading ? (
                        <Skeleton className="h-full w-full" />
                      ) : (
                        <img
                          key={`mobile-best-deals-banner-active-${activePopularBannerSlide}`}
                          src={popularBannerAttrs.src}
                          srcSet={popularBannerAttrs.srcSet}
                          sizes={popularBannerAttrs.sizes}
                          alt="Laptops section banner"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full animate-fade-in object-cover object-center transition-transform duration-200 ease-[ease] group-hover:scale-[1.02]"
                        />
                      )}
                      {!homepageBannersLoading && popularBanners.length > 1 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
                          {popularBanners.map((_, bannerIndex) => (
                            <button
                              key={`mobile-best-deals-banner-${bannerIndex}`}
                              type="button"
                              aria-label={`Show best deals banner ${bannerIndex + 1}`}
                              onClick={(event) => {
                                event.preventDefault();
                                setActivePopularBannerSlide(bannerIndex);
                              }}
                              className={`pointer-events-auto rounded-full transition-all ${
                                activePopularBannerSlide === bannerIndex ? "h-1.5 w-4 bg-white" : "h-1.5 w-1.5 bg-white/65"
                              }`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </a>
                  <div>
                    <ProductCard product={p} whatsAppNumber={waNumber} />
                  </div>
                </div>
                ) : (
                <div
                  key={p.id}
                >
                  <ProductCard product={p} whatsAppNumber={waNumber} />
                </div>
              )
            ))}
          </div>
          {desktopLaptopsLoading ? (
            <p className="hidden rounded-lg bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground md:block">
              Loading products...
            </p>
          ) : desktopLaptops.length > 0 ? (
            <div className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {desktopLaptops.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/35 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No products are available in this subcategory yet.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveLaptopTab("All")}>
                  Clear filter
                </Button>
                <Button asChild size="sm">
                  <Link to="/shop" search={{ category: "Laptops" } as any}>View all</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {!phonesLoading && !phonesError && phones.length > 0 && (
        <section className="site-desktop-width mx-auto px-1 py-10 md:px-6">
          <div className="mb-5 space-y-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <div className="flex items-center justify-between gap-4 md:hidden">
              <h2 className="text-2xl font-bold leading-none">Smartphones</h2>
              <Link to="/shop" search={{ category: "Smartphones" } as any} className="text-sm font-medium text-primary hover:underline">
                <span className="inline-flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <h2 className="hidden text-2xl font-bold leading-none md:block md:text-3xl">Smartphones</h2>
              <HomepageTabs
                options={SMARTPHONE_TABS}
                activeLabel={activeSmartphoneTab}
                onSelect={setActiveSmartphoneTab}
              />
            </div>
            <Link to="/shop" search={{ category: "Smartphones" } as any} className="hidden text-sm font-medium text-primary hover:underline md:inline">
              <span className="inline-flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 md:hidden">
            {mobileSmartphones.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
          </div>
          {desktopSmartphonesLoading ? (
            <p className="hidden rounded-lg bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground md:block">
              Loading products...
            </p>
          ) : desktopSmartphones.length > 0 ? (
            <div className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {desktopSmartphones.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/35 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No products are available in this subcategory yet.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveSmartphoneTab("All")}>
                  Clear filter
                </Button>
                <Button asChild size="sm">
                  <Link to="/shop" search={{ category: "Smartphones" } as any}>View all</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {!monitorsLoading && !monitorsError && monitors.length > 0 && (
        <section className="site-desktop-width mx-auto px-1 py-10 md:px-6">
          <div className="mb-5 space-y-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <div className="flex items-center justify-between gap-4 md:hidden">
              <h2 className="text-2xl font-bold leading-none">Monitors</h2>
              <Link to="/shop" search={{ category: "Monitors" } as any} className="text-sm font-medium text-primary hover:underline">
                <span className="inline-flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <h2 className="hidden text-2xl font-bold leading-none md:block md:text-3xl">Monitors</h2>
              <HomepageTabs options={MONITOR_TABS} activeLabel={activeMonitorTab} onSelect={setActiveMonitorTab} />
            </div>
            <Link to="/shop" search={{ category: "Monitors" } as any} className="hidden text-sm font-medium text-primary hover:underline md:inline">
              <span className="inline-flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 md:hidden">
            {mobileMonitors.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
          </div>
          {desktopMonitorsLoading ? (
            <p className="hidden rounded-lg bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground md:block">
              Loading products...
            </p>
          ) : desktopMonitors.length > 0 ? (
            <div className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {desktopMonitors.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/35 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No products are available in this subcategory yet.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveMonitorTab("All")}>
                  Clear filter
                </Button>
                <Button asChild size="sm">
                  <Link to="/shop" search={{ category: "Monitors" } as any}>View all</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {!audioLoading && !audioError && audio.length > 0 && (
        <section className="site-desktop-width mx-auto px-1 py-10 md:px-6">
          <div className="mb-5 space-y-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <div className="flex items-center justify-between gap-4 md:hidden">
              <h2 className="text-2xl font-bold leading-none">Audio</h2>
              <Link to="/shop" search={{ category: "Audio" } as any} className="text-sm font-medium text-primary hover:underline">
                <span className="inline-flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <h2 className="hidden text-2xl font-bold leading-none md:block md:text-3xl">Audio</h2>
              <HomepageTabs options={AUDIO_TABS} activeLabel={activeAudioTab} onSelect={setActiveAudioTab} />
            </div>
            <Link to="/shop" search={{ category: "Audio" } as any} className="hidden text-sm font-medium text-primary hover:underline md:inline">
              <span className="inline-flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 md:hidden">
            {mobileAudio.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
          </div>
          {desktopAudioLoading ? (
            <p className="hidden rounded-lg bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground md:block">
              Loading products...
            </p>
          ) : desktopAudio.length > 0 ? (
            <div className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {desktopAudio.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/35 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No products are available in this subcategory yet.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveAudioTab("All")}>
                  Clear filter
                </Button>
                <Button asChild size="sm">
                  <Link to="/shop" search={{ category: "Audio" } as any}>View all</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {!printersLoading && !printersError && printers.length > 0 && (
        <section className="site-desktop-width mx-auto px-1 py-10 md:px-6">
          <div className="mb-5 space-y-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <div className="flex items-center justify-between gap-4 md:hidden">
              <h2 className="text-2xl font-bold leading-none">Printers</h2>
              <Link to="/shop" search={{ category: "Printers" } as any} className="text-sm font-medium text-primary hover:underline">
                <span className="inline-flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <h2 className="hidden text-2xl font-bold leading-none md:block md:text-3xl">Printers</h2>
              <HomepageTabs options={PRINTER_TABS} activeLabel={activePrinterTab} onSelect={setActivePrinterTab} />
            </div>
            <Link to="/shop" search={{ category: "Printers" } as any} className="hidden text-sm font-medium text-primary hover:underline md:inline">
              <span className="inline-flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 md:hidden">
            {mobilePrinters.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
          </div>
          {desktopPrintersLoading ? (
            <p className="hidden rounded-lg bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground md:block">
              Loading products...
            </p>
          ) : desktopPrinters.length > 0 ? (
            <div className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {desktopPrinters.map((p) => <ProductCard key={p.id} product={p} whatsAppNumber={waNumber} />)}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/35 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No products are available in this subcategory yet.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setActivePrinterTab("All")}>
                  Clear filter
                </Button>
                <Button asChild size="sm">
                  <Link to="/shop" search={{ category: "Printers" } as any}>View all</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
