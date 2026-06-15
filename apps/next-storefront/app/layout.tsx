import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata } from "@/lib/seo";
import { organizationSchema } from "@/lib/schema";
import { siteConfig } from "@/lib/site";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = buildMetadata({
  title: "Fast SEO-first eCommerce for gadgets and electronics",
  description:
    "High-performance eCommerce storefront for laptops, monitors, phones, accessories, and business electronics.",
});

metadata.metadataBase = new URL(siteConfig.url);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans antialiased">
        <JsonLd data={organizationSchema()} />
        {children}
      </body>
    </html>
  );
}
