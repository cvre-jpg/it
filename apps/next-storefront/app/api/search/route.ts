import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const results = await searchProducts(query, 6);

  return NextResponse.json(
    {
      results: results.map((product) => ({
        slug: product.slug,
        title: product.title,
        price: product.price,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
