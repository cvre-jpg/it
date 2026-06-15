export const formatKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n);
