# Next Storefront Foundation

This app is a migration-ready Next.js App Router storefront built beside the current TanStack application so the existing site can keep running while the SEO and performance layer is modernized.

## Included

- Next.js App Router with server components by default
- TypeScript and Tailwind CSS
- Neon PostgreSQL data access with CSV fallback
- ISR-ready product, category, brand, and blog routes
- Dynamic metadata and canonical URLs
- Product, breadcrumb, article, FAQ, and organization schema
- Auto-generated `sitemap.xml` and `robots.txt`
- Cloudinary-friendly `next/image` usage with AVIF/WebP output
- Lightweight search autocomplete route

## Run locally

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL`
- `CLOUDINARY_CLOUD_NAME`

## Suggested next migration steps

1. Move cart, wishlist, checkout, and account flows into dedicated client islands.
2. Point product images entirely to Cloudinary and retire local uploads.
3. Add authenticated dashboard flows or bridge the current admin app through shared APIs.
4. Add real reviews, Merchant Center feeds, and location landing pages.
