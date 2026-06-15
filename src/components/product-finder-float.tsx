import { useNavigate } from "@tanstack/react-router";
import { Bot, Monitor, Printer, Search, Smartphone, X, Laptop, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

type FinderCategory = "laptops" | "monitors" | "smartphones" | "printers";

const CATEGORIES: Array<{
  label: string;
  value: FinderCategory;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { label: "Laptop", value: "laptops", icon: Laptop },
  { label: "Monitor", value: "monitors", icon: Monitor },
  { label: "Smartphone", value: "smartphones", icon: Smartphone },
  { label: "Printer", value: "printers", icon: Printer },
];

const BRANDS_BY_CATEGORY: Record<FinderCategory, string[]> = {
  laptops: ["HP", "Dell", "Lenovo", "Apple", "Acer", "Asus", "Microsoft"],
  monitors: ["HP", "Dell", "Lenovo", "Samsung", "LG", "Acer", "Asus"],
  smartphones: ["Apple", "Samsung", "Xiaomi", "Oppo", "Tecno", "Infinix", "Huawei"],
  printers: ["HP", "Epson", "Canon", "Brother", "Kyocera", "Rongta", "Zebra"],
};

const CATEGORY_LABEL_BY_VALUE: Record<FinderCategory, string> = {
  laptops: "Laptops",
  monitors: "Monitors",
  smartphones: "Smartphones",
  printers: "Printers",
};

const LAPTOP_SPEC_OPTIONS = {
  ram: ["4GB RAM", "8GB RAM", "16GB RAM", "32GB RAM", "64GB RAM"],
  storage: ["256GB SSD", "512GB SSD", "1TB SSD", "2TB SSD"],
};

const SPEC_OPTIONS: Record<
  FinderCategory,
  Array<{ key: string; label: string; options: string[] }>
> = {
  laptops: [
    { key: "ram", label: "RAM", options: LAPTOP_SPEC_OPTIONS.ram },
    { key: "storage", label: "Storage", options: LAPTOP_SPEC_OPTIONS.storage },
  ],
  monitors: [
    { key: "size", label: "Size", options: ["19 inch", "22 inch", "24 inch", "27 inch", "32 inch"] },
    { key: "resolution", label: "Resolution", options: ["HD", "Full HD", "2K", "4K UHD"] },
  ],
  smartphones: [
    { key: "ram", label: "RAM", options: ["3GB RAM", "4GB RAM", "6GB RAM", "8GB RAM", "12GB RAM"] },
    { key: "storage", label: "Storage", options: ["64GB", "128GB", "256GB", "512GB", "1TB"] },
  ],
  printers: [
    { key: "printType", label: "Print type", options: ["Laser", "Inkjet"] },
    { key: "printFunction", label: "Function", options: ["Print only", "Print scan copy"] },
  ],
};

export function ProductFinderFloat() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FinderCategory>("laptops");
  const [brands, setBrands] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const brandOptions = useMemo(() => BRANDS_BY_CATEGORY[category], [category]);
  const panelWidthClass =
    category === "printers"
      ? "max-w-[330px]"
      : category === "monitors"
        ? "max-w-[350px]"
        : category === "smartphones"
          ? "max-w-[360px]"
          : "max-w-[370px]";

  const toggleBrand = (brand: string) => {
    setBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  };

  const selectCategory = (nextCategory: FinderCategory) => {
    setCategory(nextCategory);
    setBrands((current) => current.filter((brand) => BRANDS_BY_CATEGORY[nextCategory].includes(brand)));
    setSpecs({});
  };

  const searchProducts = () => {
    const specTerms = Object.values(specs).filter(Boolean).join(" ");

    navigate({
      to: "/shop",
      search: {
        category: CATEGORY_LABEL_BY_VALUE[category],
        q: specTerms || undefined,
        brands: brands.length > 0 ? brands.join(",") : undefined,
        minPrice: minAmount.trim() || undefined,
        maxPrice: maxAmount.trim() || undefined,
      } as any,
    });
    setOpen(false);
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[65] bg-black/35 px-3 pb-24 pt-4 backdrop-blur-[2px] lg:flex lg:items-end lg:justify-end lg:bg-transparent lg:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className={`mx-auto w-fit min-w-[300px] max-w-[calc(100vw-1.5rem)] rounded-[16px] border border-[#ececec] bg-white p-3 shadow-[0_24px_80px_-28px_rgba(17,24,39,0.45)] transition-[max-width] duration-200 lg:mx-0 lg:mb-20 ${panelWidthClass}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E30613] text-white">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">Product finder</h2>
                  <p className="text-[11px] text-[#6b7280]">Choose what you need and search.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#6b7280] hover:bg-[#f5f5f5] hover:text-[#111827]"
                aria-label="Close product finder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#374151]">Item</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORIES.map((item) => {
                    const Icon = item.icon;
                    const active = item.value === category;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => selectCategory(item.value)}
                        className={`flex min-w-0 flex-col items-center gap-1 rounded-[9px] border px-1.5 py-1.5 text-center text-[10px] font-medium transition ${
                          active
                            ? "border-[#E30613] bg-[#fff1f2] text-[#E30613]"
                            : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#374151]">Brand</label>
                <div className="flex flex-wrap gap-1.5">
                  {brandOptions.map((brand) => {
                    const active = brands.includes(brand);
                    return (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => toggleBrand(brand)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          active
                            ? "border-[#E30613] bg-[#E30613] text-white"
                            : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
                        }`}
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#374151]">Specs</label>
                <div className="space-y-2">
                  {SPEC_OPTIONS[category].map((spec) => (
                    <FinderOptionChips
                      key={spec.key}
                      label={spec.label}
                      value={specs[spec.key] ?? ""}
                      options={spec.options}
                      onChange={(value) =>
                        setSpecs((current) => ({
                          ...current,
                          [spec.key]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#374151]">Amount range</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    value={minAmount}
                    onChange={(event) => setMinAmount(event.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="Min"
                    className="h-9 rounded-[9px] border border-[#e5e7eb] px-2.5 text-sm outline-none focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/15"
                  />
                  <input
                    value={maxAmount}
                    onChange={(event) => setMaxAmount(event.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="Max"
                    className="h-9 rounded-[9px] border border-[#e5e7eb] px-2.5 text-sm outline-none focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/15"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={searchProducts}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#E30613] px-4 text-sm font-semibold text-white transition hover:bg-[#c70511]"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[10.5rem] right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#E30613] text-white transition hover:bg-[#c70511] lg:bottom-24 lg:right-6"
        aria-label="Open product finder"
      >
        <SlidersHorizontal className="h-5.5 w-5.5" />
      </button>
    </>
  );
}

function FinderOptionChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#6b7280]">{label}</span>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="text-[11px] font-medium text-[#E30613]">
            Any
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(value === option ? "" : option)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              value === option
                ? "border-[#E30613] bg-[#E30613] text-white"
                : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
