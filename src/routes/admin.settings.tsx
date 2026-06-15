import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { prepareUploadedImage } from "@/lib/images";
import { toast } from "sonner";
import {
  fetchAdminHomepageBanners,
  fetchAdminWhatsAppSetting,
  saveAdminHomepageBanners,
  saveAdminWhatsAppSetting,
  storeAdminBannerImages,
} from "@/lib/admin-data";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type BannerSlideForm = {
  title: string;
  description: string;
  image: string;
  url: string;
  ctaLabel: string;
};

type RightBannerForm = {
  image: string;
  url: string;
};

type PopularBannerForm = {
  image: string;
  url: string;
};

const DEFAULT_HERO_SLIDES: BannerSlideForm[] = [
  {
    title: "Smart deals on premium gadgets",
    description: "Shop laptops, phones and accessories picked for modern everyday performance.",
    image: "",
    url: "/shop",
    ctaLabel: "Shop now",
  },
  {
    title: "Fresh laptop picks for work and gaming",
    description: "Discover powerful portable setups with clean performance and reliable battery life.",
    image: "",
    url: "/shop?category=laptops",
    ctaLabel: "Shop now",
  },
  {
    title: "Top phone offers built for everyday speed",
    description: "Explore stylish smartphones and mobile essentials at compact ecommerce prices.",
    image: "",
    url: "/shop?category=smartphones",
    ctaLabel: "Shop now",
  },
];

function emptyRightBanner(): RightBannerForm {
  return { image: "", url: "/shop" };
}

function emptyPopularBanner(): PopularBannerForm {
  return { image: "", url: "/shop" };
}

function AdminSettings() {
  const qc = useQueryClient();
  const [wa, setWa] = useState("");
  const [heroSlides, setHeroSlides] = useState<BannerSlideForm[]>(DEFAULT_HERO_SLIDES);
  const [rightBanner, setRightBanner] = useState<RightBannerForm>(emptyRightBanner());
  const [popularBanners, setPopularBanners] = useState<PopularBannerForm[]>([
    emptyPopularBanner(),
    emptyPopularBanner(),
  ]);
  const [shopMobileBanners, setShopMobileBanners] = useState<PopularBannerForm[]>([
    emptyPopularBanner(),
    emptyPopularBanner(),
    emptyPopularBanner(),
  ]);
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);
  const [savingBanners, setSavingBanners] = useState(false);

  const { data: whatsAppValue } = useQuery({
    queryKey: ["setting-whatsapp"],
    queryFn: () => fetchAdminWhatsAppSetting(),
  });

  const { data: bannerSettings } = useQuery({
    queryKey: ["setting-homepage-banners"],
    queryFn: () => fetchAdminHomepageBanners(),
  });

  useEffect(() => {
    if (whatsAppValue) setWa(whatsAppValue);
  }, [whatsAppValue]);

  useEffect(() => {
    if (!bannerSettings) return;

    const mergedSlides = DEFAULT_HERO_SLIDES.map((fallback, index) => ({
      ...fallback,
      ...(bannerSettings.heroSlides[index] ?? {}),
    }));

    setHeroSlides(mergedSlides);
    setRightBanner({
      ...emptyRightBanner(),
      ...(bannerSettings.rightBanner ?? {}),
    });
    const nextPopularBanners = [0, 1].map((index) => ({
      ...emptyPopularBanner(),
      ...(bannerSettings.popularBanners?.[index] ?? {}),
    }));
    setPopularBanners(nextPopularBanners);
    const nextShopMobileBanners = [0, 1, 2].map((index) => ({
      ...emptyPopularBanner(),
      ...(bannerSettings.shopMobileBanners?.[index] ?? {}),
    }));
    setShopMobileBanners(nextShopMobileBanners);
  }, [bannerSettings]);

  const saveWhatsApp = async () => {
    try {
      setSavingWhatsApp(true);
      await saveAdminWhatsAppSetting(wa);
      toast.success("WhatsApp number saved");
      qc.invalidateQueries({ queryKey: ["setting-whatsapp"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save WhatsApp number.");
    } finally {
      setSavingWhatsApp(false);
    }
  };

  const onSlideImageChange = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await prepareUploadedImage(file, {
      maxWidth: 1800,
      maxHeight: 1200,
      quality: 0.8,
      mimeType: "image/webp",
    });
    setHeroSlides((current) => current.map((slide, slideIndex) => (slideIndex === index ? { ...slide, image: dataUrl } : slide)));
    event.target.value = "";
  };

  const onRightBannerImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await prepareUploadedImage(file, {
      maxWidth: 1800,
      maxHeight: 1200,
      quality: 0.8,
      mimeType: "image/webp",
    });
    setRightBanner((current) => ({ ...current, image: dataUrl }));
    event.target.value = "";
  };

  const onPopularBannerImageChange = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await prepareUploadedImage(file, {
      maxWidth: 1800,
      maxHeight: 1200,
      quality: 0.8,
      mimeType: "image/webp",
    });
    setPopularBanners((current) =>
      current.map((banner, bannerIndex) => (bannerIndex === index ? { ...banner, image: dataUrl } : banner)),
    );
    event.target.value = "";
  };

  const onShopMobileBannerImageChange = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await prepareUploadedImage(file, {
      maxWidth: 1800,
      maxHeight: 1200,
      quality: 0.8,
      mimeType: "image/webp",
    });
    setShopMobileBanners((current) =>
      current.map((banner, bannerIndex) => (bannerIndex === index ? { ...banner, image: dataUrl } : banner)),
    );
    event.target.value = "";
  };

  const saveBanners = async () => {
    try {
      setSavingBanners(true);

      const nextHeroSlides = [...heroSlides];
      const heroUploads = nextHeroSlides
        .map((slide, index) => ({ slide, index }))
        .filter(({ slide }) => slide.image.startsWith("data:image/"));

      if (heroUploads.length > 0) {
        const uploaded = await storeAdminBannerImages(heroUploads.map(({ slide }) => slide.image));
        heroUploads.forEach(({ index }, uploadIndex) => {
          nextHeroSlides[index] = { ...nextHeroSlides[index], image: uploaded[uploadIndex] ?? nextHeroSlides[index].image };
        });
      }

      let nextRightBanner = { ...rightBanner };
      if (nextRightBanner.image.startsWith("data:image/")) {
        const [uploaded] = await storeAdminBannerImages([nextRightBanner.image]);
        nextRightBanner = { ...nextRightBanner, image: uploaded ?? nextRightBanner.image };
      }

      const nextPopularBanners = [...popularBanners];
      const popularUploads = nextPopularBanners
        .map((banner, index) => ({ banner, index }))
        .filter(({ banner }) => banner.image.startsWith("data:image/"));

      if (popularUploads.length > 0) {
        const uploaded = await storeAdminBannerImages(popularUploads.map(({ banner }) => banner.image));
        popularUploads.forEach(({ index }, uploadIndex) => {
          nextPopularBanners[index] = {
            ...nextPopularBanners[index],
            image: uploaded[uploadIndex] ?? nextPopularBanners[index].image,
          };
        });
      }

      const nextShopMobileBanners = [...shopMobileBanners];
      const shopMobileUploads = nextShopMobileBanners
        .map((banner, index) => ({ banner, index }))
        .filter(({ banner }) => banner.image.startsWith("data:image/"));

      if (shopMobileUploads.length > 0) {
        const uploaded = await storeAdminBannerImages(shopMobileUploads.map(({ banner }) => banner.image));
        shopMobileUploads.forEach(({ index }, uploadIndex) => {
          nextShopMobileBanners[index] = {
            ...nextShopMobileBanners[index],
            image: uploaded[uploadIndex] ?? nextShopMobileBanners[index].image,
          };
        });
      }

      await saveAdminHomepageBanners({
        heroSlides: nextHeroSlides,
        rightBanner: nextRightBanner,
        popularBanners: nextPopularBanners,
        shopMobileBanners: nextShopMobileBanners,
      });

      setHeroSlides(nextHeroSlides);
      setRightBanner(nextRightBanner);
      setPopularBanners(nextPopularBanners);
      setShopMobileBanners(nextShopMobileBanners);
      toast.success("Banner settings saved");
      qc.invalidateQueries({ queryKey: ["setting-homepage-banners"] });
      qc.invalidateQueries({ queryKey: ["homepage-banners"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save banner settings.");
    } finally {
      setSavingBanners(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h3 className="font-semibold">WhatsApp number</h3>
        <p className="mt-1 text-sm text-muted-foreground">All "Order on WhatsApp" buttons across the site point to this number.</p>
        <input
          value={wa}
          onChange={(e) => setWa(e.target.value)}
          placeholder="+254700000000"
          className="mt-4 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button className="mt-4 rounded-full" onClick={saveWhatsApp} disabled={savingWhatsApp}>
          {savingWhatsApp ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="mb-6">
          <h3 className="font-semibold">Banner settings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage homepage banners and the separate mobile carousel shown at the top of the shop page.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Promo banner 1 is the homepage right banner. Promo banners 2 and 3 rotate in the Best deals area.
          </p>
        </div>

        <div className="space-y-6">
          {heroSlides.map((slide, index) => (
            <div key={index} className="rounded-2xl border bg-background p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="font-medium">Carousel banner {index + 1}</h4>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Left carousel</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="aspect-[16/10] overflow-hidden rounded-xl border bg-[#f5f5f5]">
                    {slide.image ? (
                      <img src={slide.image} alt={`Banner ${index + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-muted-foreground">No image selected</div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={(event) => void onSlideImageChange(index, event)}
                    className="block w-full text-sm"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Title</span>
                    <input
                      value={slide.title}
                      onChange={(e) => setHeroSlides((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, title: e.target.value } : item)))}
                      className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Button label</span>
                    <input
                      value={slide.ctaLabel}
                      onChange={(e) => setHeroSlides((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ctaLabel: e.target.value } : item)))}
                      className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium">Description</span>
                    <textarea
                      value={slide.description}
                      onChange={(e) => setHeroSlides((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, description: e.target.value } : item)))}
                      rows={3}
                      className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium">Click URL</span>
                    <input
                      value={slide.url}
                      onChange={(e) => setHeroSlides((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, url: e.target.value } : item)))}
                      placeholder="/shop or https://..."
                      className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border bg-background p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="font-medium">Promo banner 1</h4>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Homepage right banner</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="aspect-[54/19] overflow-hidden rounded-xl border bg-[#111827]">
                  {rightBanner.image ? (
                    <img src={rightBanner.image} alt="Right homepage banner" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-white/70">No image selected</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={(event) => void onRightBannerImageChange(event)}
                  className="block w-full text-sm"
                />
              </div>

              <div className="grid gap-3 self-start">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Click URL</span>
                  <input
                    value={rightBanner.url}
                    onChange={(e) => setRightBanner((current) => ({ ...current, url: e.target.value }))}
                    placeholder="/shop or https://..."
                    className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <p className="text-sm text-muted-foreground">
                  Upload the first promo image and set the page or product link users should open when they click it.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="font-medium">Promo banners 2 and 3</h4>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Homepage Best deals</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {popularBanners.map((banner, index) => (
                <div key={`popular-banner-${index}`} className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="aspect-square overflow-hidden rounded-xl border bg-[#f5f5f5]">
                      {banner.image ? (
                        <img src={banner.image} alt={`Popular banner ${index + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted-foreground">No image selected</div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={(event) => void onPopularBannerImageChange(index, event)}
                      className="block w-full text-sm"
                    />
                  </div>

                  <div className="grid gap-3 self-start">
                    <p className="text-sm font-medium text-foreground">Promo banner {index + 2}</p>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">Click URL</span>
                      <input
                        value={banner.url}
                        onChange={(e) =>
                          setPopularBanners((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, url: e.target.value } : item)),
                          )
                        }
                        placeholder="/shop or https://..."
                        className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Promo banner {index + 2} rotates in the homepage Best deals section every 5 seconds.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="font-medium">Mobile shop carousel</h4>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Shop page on mobile</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload up to 3 wide banners shown above the products on mobile. Until one is uploaded, the shop page uses the homepage promo banners.
            </p>

            <div className="grid gap-4 lg:grid-cols-3">
              {shopMobileBanners.map((banner, index) => (
                <div key={`shop-mobile-banner-${index}`} className="space-y-3 rounded-xl border p-3">
                  <p className="text-sm font-medium text-foreground">Mobile banner {index + 1}</p>
                  <div className="aspect-[16/6] overflow-hidden rounded-xl border bg-[#111827]">
                    {banner.image ? (
                      <img src={banner.image} alt={`Mobile shop banner ${index + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-white/70">No image selected</div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={(event) => void onShopMobileBannerImageChange(index, event)}
                    className="block w-full text-sm"
                  />
                  <label className="block space-y-2 text-sm">
                    <span className="font-medium">Click URL</span>
                    <input
                      value={banner.url}
                      onChange={(e) =>
                        setShopMobileBanners((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, url: e.target.value } : item)),
                        )
                      }
                      placeholder="/shop or https://..."
                      className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button className="mt-6 rounded-full" onClick={saveBanners} disabled={savingBanners}>
          {savingBanners ? "Saving..." : "Save banners"}
        </Button>
      </div>
    </div>
  );
}
