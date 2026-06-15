import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/catalog";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #f6f6f1 0%, #ffffff 55%, #f3e8e8 100%)",
          color: "#101314",
          padding: "64px",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#cb2f2f" }}>
          Shop ICT Gadgets
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>
            {product?.title || "Premium electronics"}
          </div>
          <div style={{ fontSize: 28, color: "#455154", maxWidth: "860px" }}>
            {product?.brand || product?.categoryName || "Fast, structured, SEO-ready product pages"}
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#455154" }}>
          shopictgadgets.co.ke
        </div>
      </div>
    ),
    size,
  );
}
