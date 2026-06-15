import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

export function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

export function shimmer(width: number, height: number) {
  return `
    <svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g">
          <stop stop-color="#ece7dd" offset="20%" />
          <stop stop-color="#f6f6f1" offset="50%" />
          <stop stop-color="#ece7dd" offset="70%" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#ece7dd" />
      <rect id="r" width="${width}" height="${height}" fill="url(#g)" />
      <animate xlink:href="#r" attributeName="x" from="-${width}" to="${width}" dur="1.4s" repeatCount="indefinite"  />
    </svg>
  `;
}

export function toBase64(value: string) {
  return Buffer.from(value).toString("base64");
}
