import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { truncate, cleanText } from "@/lib/utils";

export function buildTitle(value: string) {
  return `${value} | ${siteConfig.name}`;
}

export function buildDescription(value: string | null | undefined, fallback = siteConfig.description) {
  return truncate(cleanText(value) || fallback, 160);
}

export function buildMetadata({
  title,
  description,
  path = "/",
  image,
  keywords = [],
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image || absoluteUrl("/opengraph-image");

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      creator: siteConfig.social.twitter,
    },
  };
}
