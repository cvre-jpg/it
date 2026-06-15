import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { z } from "zod";
import { fetchShopPageData, type ProductSummaryWithCategory } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { useWhatsAppNumber, DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { buildResponsiveImageAttrs } from "@/lib/images";
import { cn } from "@/lib/utils";
import {
  ALL_CATEGORIES_LABEL,
  CATEGORY_TREE,
  getCategoryGroupBySearchParam,
  isSubcategoryForMainCategory,
  type MainCategory,
} from "@/lib/category-tree";
import { absoluteUrl, buildMetaDescription, buildTitle } from "@/lib/seo";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/shop")({
  validateSearch: z.object({
    category: z.string().optional(),
    subcategory: z.string().optional(),
    q: z.string().optional(),
    brands: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
  }),
  component: ShopPage,
  head: ({ match }) => {
    const search = match.search;
    const categoryGroup = getCategoryGroupBySearchParam(search.category);
    const subcategory =
      categoryGroup && isSubcategoryForMainCategory(categoryGroup.label, search.subcategory)
        ? search.subcategory
        : null;
    const isSearchResultsPage = Boolean(search.q?.trim());
    const pageLabel = subcategory ?? categoryGroup?.label ?? "Shop Electronics Online";
    const canonicalSearch = new URLSearchParams();

    if (categoryGroup) canonicalSearch.set("category", categoryGroup.query);
    if (subcategory) canonicalSearch.set("subcategory", subcategory);

    const canonicalPath = canonicalSearch.size > 0 ? `/shop?${canonicalSearch.toString()}` : "/shop";
    const description = subcategory
      ? `Shop ${subcategory.toLowerCase()} in Kenya from Shop ICT Gadgets. Browse prices, specs and availability.`
      : categoryGroup
        ? `Shop ${categoryGroup.label.toLowerCase()} in Kenya from Shop ICT Gadgets. Browse prices, specs and availability.`
        : "Browse our full catalog of laptops, smartphones, monitors, printers, audio gear and accessories at Shop ICT Gadgets.";
    const title = buildTitle(pageLabel);

    return {
      meta: [
        { title },
      {
        name: "description",
        content: buildMetaDescription(
            description,
          "Browse our full electronics catalog.",
        ),
      },
        { name: "robots", content: isSearchResultsPage ? "noindex, follow" : "index, follow" },
        { property: "og:title", content: title },
      {
        property: "og:description",
          content: description,
      },
      { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl(canonicalPath) },
      { property: "og:image", content: absoluteUrl("/logo.png") },
      { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
      {
        name: "twitter:description",
          content: description,
      },
      { name: "twitter:image", content: absoluteUrl("/logo.png") },
    ],
      links: [{ rel: "canonical", href: absoluteUrl(canonicalPath) }],
    };
  },
});

const SORT_OPTIONS = [
  { label: "Most popular", value: "popular" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Newest", value: "newest" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];
type SelectedCategory = MainCategory | typeof ALL_CATEGORIES_LABEL;

function resolveBannerUrl(url: string) {
  const value = String(url ?? "").trim();
  if (!value) return "/shop";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function ShopPage() {
  const navigate = useNavigate({ from: "/shop" });
  const search = Route.useSearch();
  const { data: waNumber = DEFAULT_WHATSAPP_NUMBER } = useWhatsAppNumber();
  const initialScrollResetDone = useRef(false);
  const productListTopRef = useRef<HTMLDivElement | null>(null);
  const paginationScrollReadyRef = useRef(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<MainCategory | "">("");
  const [sortBy, setSortBy] = useState<SortValue>("popular");
  const [page, setPage] = useState(1);
  const [mobilePromoEmblaRef, mobilePromoEmblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: true,
    slidesToScroll: 1,
  });
  const [activeMobilePromoSlide, setActiveMobilePromoSlide] = useState(0);
  const selectedCategoryGroup = getCategoryGroupBySearchParam(search.category);
  const selectedMainCategory: SelectedCategory = selectedCategoryGroup?.label ?? ALL_CATEGORIES_LABEL;
  const selectedSubcategory =
    selectedCategoryGroup && isSubcategoryForMainCategory(selectedCategoryGroup.label, search.subcategory)
      ? search.subcategory
      : null;
  const selectedCategoryQuery =
    selectedMainCategory === ALL_CATEGORIES_LABEL
      ? undefined
      : selectedCategoryGroup?.query;
  const selectedBrands = String(search.brands ?? "")
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
  const minPrice = search.minPrice ? Number(search.minPrice) : null;
  const maxPrice = search.maxPrice ? Number(search.maxPrice) : null;
  const normalizedSearchQuery = search.q?.trim() ?? "";
  const shopProductsRequest = {
    categorySlug: selectedCategoryQuery,
    subcategory: selectedSubcategory ?? undefined,
    brands: selectedBrands,
    minPrice,
    maxPrice,
    search: search.q,
    sortBy,
    page,
    pageSize: 20,
  } as const;
  const searchSuggestionsRequest =
    normalizedSearchQuery.length > 0
      ? {
          search: normalizedSearchQuery,
          sortBy: "popular" as const,
          pageSize: 8,
        }
      : null;
  const categorySearchSuggestionsRequest =
    selectedCategoryQuery && normalizedSearchQuery.length > 0
      ? {
          categorySlug: selectedCategoryQuery,
          search: normalizedSearchQuery,
          sortBy: "popular" as const,
          pageSize: 8,
        }
      : null;
  const categorySuggestionsRequest = selectedCategoryQuery
    ? {
        categorySlug: selectedCategoryQuery,
        sortBy: "popular" as const,
        pageSize: 8,
      }
    : null;

  const {
    data: shopPageData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["shop-products", selectedCategoryQuery, selectedSubcategory, search.q, search.brands, search.minPrice, search.maxPrice, sortBy, page],
    queryFn: () =>
      fetchShopPageData({
        products: shopProductsRequest,
        searchSuggestions: searchSuggestionsRequest,
        categorySearchSuggestions: categorySearchSuggestionsRequest,
        categorySuggestions: categorySuggestionsRequest,
      }),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    placeholderData: keepPreviousData,
  });
  const shopResult = shopPageData?.products;
  const searchSuggestionResult = shopPageData?.searchSuggestions;
  const categorySearchSuggestionResult = shopPageData?.categorySearchSuggestions;
  const categorySuggestionResult = shopPageData?.categorySuggestions;
  const homepageBanners = shopPageData?.homepageBanners;
  const searchSuggestionsLoading = isLoading && normalizedSearchQuery.length > 0;

  const products = shopResult?.products ?? [];
  const totalProducts = shopResult?.total ?? 0;
  const pageSize = shopResult?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const currentPage = Math.min(page, totalPages);
  const resultStart = totalProducts === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const resultEnd = Math.min(currentPage * pageSize, totalProducts);
  const pageTitle = normalizedSearchQuery ? `Search results for "${normalizedSearchQuery}"` : selectedSubcategory ?? selectedMainCategory;
  const hasActiveFilters =
    selectedMainCategory !== ALL_CATEGORIES_LABEL ||
    Boolean(selectedSubcategory) ||
    selectedBrands.length > 0 ||
    Boolean(search.minPrice) ||
    Boolean(search.maxPrice) ||
    normalizedSearchQuery.length > 0;
  const categorySearchSuggestions = categorySearchSuggestionResult?.products ?? [];
  const categorySuggestions = categorySuggestionResult?.products ?? [];
  const searchSuggestions = searchSuggestionResult?.products ?? [];
  const suggestedProducts =
    categorySearchSuggestions.length > 0
      ? categorySearchSuggestions
      : categorySuggestions.length > 0
        ? categorySuggestions
        : searchSuggestions;
  const legacyMobilePromoBanners = [
    homepageBanners?.rightBanner,
    ...(homepageBanners?.popularBanners ?? []),
  ].filter((banner): banner is { image: string; url: string } => Boolean(banner?.image));
  const mobilePromoBanners =
    homepageBanners?.shopMobileBanners.length
      ? homepageBanners.shopMobileBanners
      : legacyMobilePromoBanners.slice(0, 3);
  const getMobilePromoImageAttrs = (image: string) =>
    buildResponsiveImageAttrs(image, {
      width: 1200,
      height: 450,
      widths: [360, 540, 720, 960],
      sizes: "92vw",
      quality: "q_auto:eco",
    });

  const visiblePagination = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.max(1, Math.min(totalPages - 4, currentPage - 2));
    return start + index;
  });

  const handleSelectAllCategories = () => {
    navigate({ search: (current) => ({ ...current, category: undefined, subcategory: undefined }) });
    setPage(1);
    if (window.innerWidth < 1024) setMobileFiltersOpen(false);
  };

  const handleClearFilters = () => {
    navigate({
      search: (current) => ({
        ...current,
        category: undefined,
        subcategory: undefined,
        q: undefined,
        brands: undefined,
        minPrice: undefined,
        maxPrice: undefined,
      }),
    });
    setPage(1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) setMobileFiltersOpen(false);
  };

  const handleSelectMainCategory = (label: MainCategory) => {
    const category = CATEGORY_TREE.find((item) => item.label === label);
    navigate({ search: (current) => ({ ...current, category: category?.query ?? label, subcategory: undefined }) });
    setOpenCategory(label);
    setPage(1);
    if (window.innerWidth < 1024) setMobileFiltersOpen(false);
  };

  const handleSelectSubcategory = (mainCategory: MainCategory, subcategory: string) => {
    const category = CATEGORY_TREE.find((item) => item.label === mainCategory);
    navigate({ search: (current) => ({ ...current, category: category?.query ?? mainCategory, subcategory }) });
    setOpenCategory(mainCategory);
    setPage(1);
    if (window.innerWidth < 1024) setMobileFiltersOpen(false);
  };

  useEffect(() => {
    if (selectedMainCategory === ALL_CATEGORIES_LABEL) {
      setOpenCategory("");
      return;
    }

    if (selectedSubcategory && selectedMainCategory !== ALL_CATEGORIES_LABEL) {
      setOpenCategory(selectedMainCategory);
      return;
    }

    if (selectedMainCategory !== ALL_CATEGORIES_LABEL) {
      setOpenCategory(selectedMainCategory);
    }
  }, [selectedMainCategory, selectedSubcategory]);

  useEffect(() => {
    if (initialScrollResetDone.current || isLoading || typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    initialScrollResetDone.current = true;
  }, [isLoading]);

  useEffect(() => {
    if (!paginationScrollReadyRef.current) {
      paginationScrollReadyRef.current = true;
      return;
    }

    productListTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

  useEffect(() => {
    if (!mobilePromoEmblaApi) return;

    const syncSelected = () => {
      setActiveMobilePromoSlide(mobilePromoEmblaApi.selectedScrollSnap());
    };

    syncSelected();
    mobilePromoEmblaApi.on("select", syncSelected);
    mobilePromoEmblaApi.on("reInit", syncSelected);

    return () => {
      mobilePromoEmblaApi.off("select", syncSelected);
      mobilePromoEmblaApi.off("reInit", syncSelected);
    };
  }, [mobilePromoEmblaApi]);

  useEffect(() => {
    if (!mobilePromoEmblaApi) return;
    if (mobilePromoBanners.length <= 1) {
      mobilePromoEmblaApi.scrollTo(0, true);
      setActiveMobilePromoSlide(0);
      return;
    }

    const autoplay = window.setInterval(() => {
      mobilePromoEmblaApi.scrollNext();
    }, 5000);

    return () => window.clearInterval(autoplay);
  }, [mobilePromoEmblaApi, mobilePromoBanners.length]);

  return (
    <div className="bg-white">
      <div className="site-desktop-width mx-auto px-1 py-8 md:px-6">
        {mobilePromoBanners.length > 0 ? (
          <section className="mb-5 px-2 lg:hidden">
            <div>
              <div className="relative overflow-hidden rounded-[12px]" ref={mobilePromoEmblaRef}>
                <div className="flex">
                  {mobilePromoBanners.map((banner, index) => (
                    <div key={`shop-mobile-promo-${index}`} className="min-w-0 flex-[0_0_100%]">
                      {(() => {
                        const imageAttrs = getMobilePromoImageAttrs(banner.image);
                        return (
                      <a
                        href={resolveBannerUrl(banner.url)}
                        className="group relative block aspect-[16/6] overflow-hidden rounded-[12px] bg-[#111827]"
                      >
                        <img
                          src={imageAttrs.src}
                          srcSet={imageAttrs.srcSet}
                          sizes={imageAttrs.sizes}
                          alt={`Shop promo banner ${index + 1}`}
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </a>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                {mobilePromoBanners.length > 1 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-sm">
                    {mobilePromoBanners.map((_, index) => (
                      <button
                        key={`shop-mobile-promo-dot-${index}`}
                        type="button"
                        aria-label={`Show shop promo banner ${index + 1}`}
                        onClick={() => mobilePromoEmblaApi?.scrollTo(index)}
                        className={cn(
                          "rounded-full transition-all",
                          activeMobilePromoSlide === index ? "h-2 w-5 bg-[#e92d48]" : "h-2 w-2 bg-[#cbd5e1]",
                        )}
                      />
                    ))}
                  </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <div className="mb-5 flex items-center justify-between gap-4 lg:hidden">
            <h1 className="text-[34px] font-normal leading-none text-[#222222]">{pageTitle}</h1>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 rounded-[3px] border border-[#dddddd] px-4 py-2 text-sm text-[#222222]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        <div className="grid gap-[30px] lg:grid-cols-[250px_minmax(0,1fr)]">
          <CategorySidebar
            mobileOpen={mobileFiltersOpen}
            onClose={() => setMobileFiltersOpen(false)}
            openCategory={openCategory}
            onToggleCategory={(label) => setOpenCategory((current) => (current === label ? "" : label))}
            selectedMainCategory={selectedMainCategory}
            selectedSubcategory={selectedSubcategory}
            onSelectAllCategories={handleSelectAllCategories}
            onSelectMainCategory={handleSelectMainCategory}
            onSelectSubcategory={handleSelectSubcategory}
          />

          <main>
            <h1 className="hidden text-[34px] font-normal leading-none text-[#222222] lg:block">
              {pageTitle}
            </h1>

            {isError ? (
              <div className="mt-4 rounded-[6px] border border-[#f2b7c1] bg-[#fff4f6] px-4 py-3 text-sm text-[#c42544]">
                Could not load products. {error instanceof Error ? error.message : "Please check the database connection and try again."}
              </div>
            ) : null}

            <div ref={productListTopRef} className="scroll-mt-24" />

            <div className="mt-3 hidden border-b border-[#dddddd] pb-4 md:flex md:flex-row md:items-center md:justify-between">
              <p className="text-[13px] text-[#222222]">
                Showing {resultStart} to {resultEnd} of {totalProducts} results.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <ControlSelect
                  label="Sort by"
                  value={sortBy}
                  options={SORT_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                  onChange={(value) => {
                    setSortBy(value as SortValue);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-1 md:grid-cols-4 md:gap-3 2xl:grid-cols-6 2xl:gap-3">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div key={`shop-skeleton-${index}`} className="mb-3 flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] sm:mb-0 sm:rounded-xl sm:border sm:bg-card sm:p-[4px] sm:shadow-none">
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
                ))
              ) : null}
              {products.map((product) => (
                <ProductCard key={product.id} product={product} whatsAppNumber={waNumber} />
              ))}
              {!isLoading && !isError && products.length === 0 ? (
                <ShopEmptyState
                  hasActiveFilters={hasActiveFilters}
                  searchQuery={normalizedSearchQuery}
                  suggestions={suggestedProducts}
                  suggestionsLoading={searchSuggestionsLoading}
                  whatsAppNumber={waNumber}
                  onClearFilters={handleClearFilters}
                />
              ) : null}
            </div>

            {totalProducts > 0 ? (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                {visiblePagination.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={cn(
                      "inline-flex h-8 min-w-8 items-center justify-center rounded-[3px] border px-3 text-sm",
                      currentPage === item
                        ? "border-[#e92d48] bg-[#e92d48] text-white"
                        : "border-[#dddddd] bg-white text-[#e92d48]",
                    )}
                  >
                    {item}
                  </button>
                ))}
                {totalPages > visiblePagination.length ? (
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-[3px] border border-[#dddddd] bg-white px-3 text-sm text-[#e92d48]">
                    ...
                  </span>
                ) : null}
                {totalPages > visiblePagination.length ? (
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-[3px] border border-[#dddddd] bg-white px-3 text-sm text-[#e92d48]"
                  >
                    {totalPages}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="inline-flex h-8 items-center justify-center rounded-[3px] border border-[#dddddd] bg-white px-3 text-sm text-[#e92d48]"
                >
                  Next
                </button>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function ShopEmptyState({
  hasActiveFilters,
  searchQuery,
  suggestions,
  suggestionsLoading,
  whatsAppNumber,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  searchQuery: string;
  suggestions: ProductSummaryWithCategory[];
  suggestionsLoading: boolean;
  whatsAppNumber: string;
  onClearFilters: () => void;
}) {
  return (
    <div className="col-span-full rounded-[8px] border border-[#eeeeee] bg-[#fafafa] px-4 py-8 text-center">
      <p className="text-sm font-medium text-[#222222]">
        {searchQuery ? `${searchQuery} not found.` : "Product not found."}
      </p>
      <p className="mt-1 text-sm text-[#6b7280]">
        {suggestions.length > 0 || suggestionsLoading
          ? "Here are similar products you may like."
          : "Try clearing the filter or searching another keyword."}
      </p>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-[3px] border border-[#e92d48] bg-white px-4 text-sm font-medium text-[#e92d48]"
        >
          Clear filter
        </button>
      ) : null}
      {suggestionsLoading ? (
        <p className="mt-6 text-sm text-[#6b7280]">Finding similar products...</p>
      ) : suggestions.length > 0 ? (
        <div className="mt-7 text-left">
          <h2 className="mb-3 text-sm font-semibold text-[#222222]">Similar products</h2>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-4 md:gap-3">
            {suggestions.map((product) => (
              <ProductCard key={product.id} product={product} whatsAppNumber={whatsAppNumber} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategorySidebar({
  mobileOpen,
  onClose,
  openCategory,
  onToggleCategory,
  selectedMainCategory,
  selectedSubcategory,
  onSelectAllCategories,
  onSelectMainCategory,
  onSelectSubcategory,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  openCategory: MainCategory | "";
  onToggleCategory: (label: MainCategory) => void;
  selectedMainCategory: SelectedCategory;
  selectedSubcategory: string | null;
  onSelectAllCategories: () => void;
  onSelectMainCategory: (label: MainCategory) => void;
  onSelectSubcategory: (mainCategory: MainCategory, subcategory: string) => void;
}) {
  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35 lg:hidden" onClick={onClose} />
      ) : null}

      <aside
        className={cn(
          "border border-[#dddddd] bg-white lg:relative lg:block",
          "lg:h-fit lg:w-[250px]",
          mobileOpen
            ? "fixed right-0 top-0 z-50 h-full w-[86vw] max-w-[320px] overflow-y-auto"
            : "hidden lg:block",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#dddddd] bg-[#f7f7f7] px-4 py-3">
          <h2 className="text-sm font-bold text-[#222222]">Categories</h2>
          <button type="button" onClick={onClose} className="lg:hidden" aria-label="Close filters">
            <X className="h-4 w-4 text-[#4b5563]" />
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={onSelectAllCategories}
            className={cn(
              "flex h-[38px] w-full items-center border-b border-[#dddddd] px-3 text-left text-sm transition-colors",
              selectedMainCategory === ALL_CATEGORIES_LABEL && !selectedSubcategory
                ? "bg-[#e92d48] text-white"
                : "text-[#4b5563] hover:bg-[#fafafa]",
            )}
          >
            All Categories
          </button>

          {CATEGORY_TREE.map((item) => {
            const isOpen = openCategory === item.label;
            const isActiveMain = selectedMainCategory === item.label && !selectedSubcategory;

            return (
              <div key={item.label}>
                <div className="flex border-b border-[#dddddd]">
                  <button
                    type="button"
                    onClick={() => onSelectMainCategory(item.label)}
                    className={cn(
                      "flex h-[38px] flex-1 items-center px-3 text-left text-sm transition-colors",
                      isActiveMain ? "bg-[#e92d48] text-white" : "text-[#4b5563] hover:bg-[#fafafa]",
                    )}
                  >
                    <span className="truncate pr-2">{item.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCategory(item.label)}
                    className="inline-flex h-[38px] w-10 items-center justify-center text-[#4b5563]"
                    aria-label={`${isOpen ? "Hide" : "Show"} ${item.label} subcategories`}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
                    />
                  </button>
                </div>

                {isOpen ? (
                  <div className="bg-white">
                    {item.items.map((subItem) => {
                      const isActiveSub = selectedMainCategory === item.label && selectedSubcategory === subItem;
                      return (
                        <button
                          key={subItem}
                          type="button"
                          onClick={() => onSelectSubcategory(item.label, subItem)}
                          className={cn(
                            "flex h-[38px] w-full items-center border-b border-[#dddddd] px-3 pl-6 text-left text-sm transition-colors",
                            isActiveSub ? "bg-[#e92d48] text-white" : "text-[#4b5563] hover:bg-[#fafafa]",
                          )}
                        >
                          <span className="truncate pr-2">{subItem}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function ControlSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-[#222222]">
      <span>{label}</span>
      <span className="relative inline-flex min-w-[132px] items-center rounded-[3px] border border-[#dddddd] bg-white">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full appearance-none bg-transparent px-3 py-2 pr-8 text-[13px] text-[#222222] outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-[#6b7280]" />
      </span>
    </label>
  );
}
