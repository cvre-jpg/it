import type { Product } from "@/lib/products";
import type { MainCategory } from "@/lib/category-tree";

type ProductWithCategory = Product & {
  categories?: { slug: string; name: string };
};

export function normalizeCatalogValue(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

export function detectMainCategory(product: ProductWithCategory): MainCategory | null {
  const categoryName = normalizeCatalogValue(product.categories?.name);
  const categorySlug = normalizeCatalogValue(product.categories?.slug);
  const title = normalizeCatalogValue(product.title);

  if (
    categoryName.includes("laptop") ||
    categorySlug.includes("laptop") ||
    title.includes("laptop") ||
    title.includes("macbook") ||
    title.includes("elitebook") ||
    title.includes("thinkpad")
  ) {
    return "Laptops";
  }

  if (
    categoryName.includes("monitor") ||
    categorySlug.includes("monitor") ||
    title.includes("monitor") ||
    title.includes("display")
  ) {
    return "Monitors";
  }

  if (
    categoryName.includes("audio") ||
    categorySlug.includes("audio") ||
    title.includes("speaker") ||
    title.includes("headphone") ||
    title.includes("headset") ||
    title.includes("earbud") ||
    title.includes("airpod") ||
    title.includes("soundbar") ||
    title.includes("microphone")
  ) {
    return "Audio";
  }

  if (
    categoryName.includes("phone") ||
    categorySlug.includes("phone") ||
    categoryName.includes("smart") ||
    categorySlug.includes("smart") ||
    title.includes("iphone") ||
    title.includes("galaxy") ||
    title.includes("android") ||
    title.includes("smart watch") ||
    title.includes("smartwatch")
  ) {
    return "Smartphones";
  }

  if (
    categoryName.includes("printer") ||
    categorySlug.includes("printer") ||
    title.includes("printer") ||
    title.includes("laserjet") ||
    title.includes("ecotank") ||
    title.includes("scanner") ||
    title.includes("barcode")
  ) {
    return "Printers";
  }

  if (
    categoryName.includes("accessor") ||
    categorySlug.includes("accessor") ||
    title.includes("keyboard") ||
    title.includes("mouse") ||
    title.includes("router") ||
    title.includes("power bank") ||
    title.includes("flash drive") ||
    title.includes("hard drive") ||
    title.includes("hdmi") ||
    title.includes("bag") ||
    title.includes("charger") ||
    title.includes("adapter")
  ) {
    return "Accessories";
  }

  return null;
}

export function detectSubcategory(mainCategory: MainCategory, title: string) {
  const value = normalizeCatalogValue(title);

  if (mainCategory === "Laptops") {
    if (value.includes("macbook")) return "MacBooks";
    if (value.includes("gaming") || value.includes("omen") || value.includes("legion") || value.includes("rog")) return "Gaming Laptops";
    if (value.includes("business") || value.includes("elitebook") || value.includes("latitude") || value.includes("thinkpad")) return "Business Laptops";
    if (value.includes("2-in-1") || value.includes("2 in 1") || value.includes("flip") || value.includes("x360") || value.includes("convertible")) return "2-in-1 Convertible Laptops";
    if (value.includes("student") || value.includes("college") || value.includes("school")) return "Student Laptops";
    if (value.includes("workstation") || value.includes("zbook") || value.includes("precision")) return "Workstation Laptops";
    if (value.includes("refurb") || value.includes("ex-uk") || value.includes("used")) return "Ex-UK Laptops";
    if (value.includes("new") || value.includes("brand new")) return "Brand New Laptops";
    return "Brand New Laptops";
  }

  if (mainCategory === "Monitors") {
    if (value.includes("refurb") || value.includes("ex-uk") || value.includes("used")) return "Ex-UK Monitors";
    if (value.includes("brand new") || value.includes("> new") || value.includes(" new ")) return "Brand New Monitors";
    if (value.includes("curved")) return "Curved Monitors";
    if (value.includes("gaming")) return "Gaming Monitors";
    if (value.includes("4k") || value.includes("uhd")) return "4K UHD Monitors";
    if (value.includes("office")) return "Office Monitors";
    if (value.includes("ultrawide")) return "Ultrawide Monitors";
    if (value.includes("portable")) return "Portable Monitors";
    if (value.includes("touch")) return "Touchscreen Monitors";
    if (value.includes("cctv") || value.includes("security")) return "CCTV Monitors";
    return "Office Monitors";
  }

  if (mainCategory === "Audio") {
    if (value.includes("soundbar")) return "Soundbars";
    if (value.includes("speaker") && (value.includes("bluetooth") || value.includes("portable"))) return "Bluetooth Speakers";
    if (value.includes("earbud") || value.includes("airpod") || value.includes("buds")) return "Wireless Earbuds";
    if (value.includes("earphone") || value.includes("wired")) return "Wired Earphones";
    if (value.includes("headphone")) return "Over-Ear Headphones";
    if (value.includes("headset") || value.includes("gaming headset")) return "Gaming Headsets";
    if (value.includes("smart speaker") || value.includes("alexa") || value.includes("google nest")) return "Smart Speakers";
    if (value.includes("microphone") || value.includes("mic") || value.includes("studio")) return "Studio Microphones";
    return "Soundbars";
  }

  if (mainCategory === "Smartphones") {
    if (value.includes("iphone")) return "iPhones";
    if (value.includes("samsung") || value.includes("galaxy")) return "Samsung Phones";
    if (value.includes("refurb")) return "Refurbished Phones";
    if (value.includes("budget") || value.includes("a0") || value.includes("a1") || value.includes("redmi a")) return "Budget Smartphones";
    if (value.includes("flagship") || value.includes("pro max") || value.includes("ultra")) return "Flagship Smartphones";
    if (value.includes("gaming")) return "Gaming Phones";
    if (value.includes("fold") || value.includes("flip")) return "Foldable Phones";
    if (value.includes("watch")) return "Smart Watches";
    return "Android Phones";
  }

  if (mainCategory === "Printers") {
    if (value.includes("inkjet") || value.includes("ink tank") || value.includes("ecotank")) return "Inkjet Printers";
    if (value.includes("laser")) return "Laser Printers";
    if (value.includes("all-in-one") || value.includes("all in one") || value.includes("multifunction")) return "All-in-One Printers";
    if (value.includes("wireless") || value.includes("wifi")) return "Wireless Printers";
    if (value.includes("receipt") || value.includes("pos")) return "Receipt Printers";
    if (value.includes("barcode") || value.includes("label")) return "Barcode Printers";
    if (value.includes("photo")) return "Photo Printers";
    if (value.includes("scanner") || value.includes("scanjet")) return "Scanner Machines";
    return "All-in-One Printers";
  }

  if (value.includes("bag") || value.includes("sleeve") || value.includes("backpack")) return "Laptop Bags";
  if (value.includes("keyboard")) return "Keyboards";
  if (value.includes("mouse") || value.includes("mice")) return "Wireless Mice";
  if (value.includes("flash drive") || value.includes("usb")) return "USB Flash Drives";
  if (value.includes("hard drive") || value.includes("ssd enclosure") || value.includes("external ssd")) return "External Hard Drives";
  if (value.includes("hdmi")) return "HDMI Cables";
  if (value.includes("power bank")) return "Power Banks";
  if (value.includes("router") || value.includes("wifi") || value.includes("wi-fi")) return "WiFi Routers";
  return "Keyboards";
}
