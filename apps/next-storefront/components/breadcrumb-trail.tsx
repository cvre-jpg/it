import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/types";

export function BreadcrumbTrail({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-black/55">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span>/</span> : null}
            <Link href={item.href} className="hover:text-ink">
              {item.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
