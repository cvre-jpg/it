import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { buildDescription, buildMetadata, buildTitle } from "@/lib/seo";

export const metadata = buildMetadata({
  title: buildTitle("Buyer guides and SEO articles"),
  description: buildDescription("Organic traffic content for electronics buyers, including FAQs, monitor guides, and laptop comparisons."),
  path: "/blog",
});

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">Buyer guides</h1>
      <p className="mt-4 text-base leading-7 text-black/68">
        SEO article templates built for long-tail capture, semantic relevance, and strong internal linking into commercial pages.
      </p>
      <div className="mt-8 space-y-4">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="block rounded-[28px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-xs uppercase tracking-[0.18em] text-black/45">{post.category}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{post.title}</h2>
            <p className="mt-3 text-sm leading-6 text-black/68">{post.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
