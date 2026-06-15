export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  brand: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  subcategories: string[];
  price: number;
  oldPrice: number | null;
  stockStatus: string;
  images: string[];
  specs: Record<string, string>;
  featured: boolean;
  hidden: boolean;
  badge: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export type Brand = {
  name: string;
  slug: string;
  productCount: number;
};

export type BreadcrumbItem = {
  name: string;
  href: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingMinutes: number;
  category: string;
  keywords: string[];
  body: string[];
  faqs?: Array<{ question: string; answer: string }>;
};
