type ImageOptions = {
  width?: number;
  height?: number;
  mode?: "fill" | "fit";
};

function isCloudinary(src: string) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(src);
}

export function getOptimizedImageUrl(src: string | null | undefined, options: ImageOptions = {}) {
  const value = String(src ?? "").trim();
  if (!value || !isCloudinary(value)) return value;

  const marker = "/upload/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return value;

  const suffix = value.slice(markerIndex + marker.length);
  if (/^(?:f_|q_|c_|w_|h_|dpr_)/.test(suffix)) return value;

  const transforms = [
    "f_auto",
    "q_auto",
    "dpr_auto",
    options.mode === "fit" ? "c_fit" : "c_fill",
    options.width ? `w_${Math.round(options.width)}` : null,
    options.height ? `h_${Math.round(options.height)}` : null,
  ]
    .filter(Boolean)
    .join(",");

  return `${value.slice(0, markerIndex + marker.length)}${transforms}/${suffix}`;
}

export function getProductAlt(title: string, brand?: string | null) {
  const prefix = brand ? `${brand} ` : "";
  return `${prefix}${title} product image`;
}
