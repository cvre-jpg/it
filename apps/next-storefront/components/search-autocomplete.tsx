"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Suggestion = {
  slug: string;
  title: string;
  price: number;
};

export function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!response.ok) return;
      const data = (await response.json()) as { results: Suggestion[] };
      setResults(data.results);
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="relative">
      <form action="/search" className="relative">
        <input
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          className="h-11 w-full rounded-full border border-black/10 bg-[#f8f7f4] px-4 text-sm outline-none ring-0 transition placeholder:text-black/35 focus:border-black/20"
        />
      </form>
      {results.length > 0 ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-soft">
          {results.map((item) => (
            <Link
              key={item.slug}
              href={`/products/${item.slug}`}
              className="block border-b border-black/5 px-4 py-3 text-sm transition hover:bg-[#f8f7f4] last:border-b-0"
            >
              <div className="font-medium text-ink">{item.title}</div>
              <div className="mt-1 text-black/60">KES {item.price.toLocaleString("en-KE")}</div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
