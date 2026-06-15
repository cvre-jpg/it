import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "64px",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #f6f6f1 0%, #ffffff 55%, #f3e8e8 100%)",
          color: "#101314",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#cb2f2f" }}>
          Shop ICT Gadgets
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.05, maxWidth: "900px" }}>
            High-performance gadget storefronts built for search and speed.
          </div>
          <div style={{ marginTop: 24, fontSize: 30, color: "#455154", maxWidth: "760px" }}>
            SEO-first product discovery for laptops, monitors, phones, accessories, and enterprise displays.
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#455154" }}>shopictgadgets.co.ke</div>
      </div>
    ),
    size,
  );
}
