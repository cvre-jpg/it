import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { buildMetadata, buildTitle } from "@/lib/seo";
import { articleSchema, faqSchema } from "@/lib/schema";
import { JsonLd } from "@/components/json-ld";

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return buildMetadata({
    title: buildTitle(post.title),
    description: post.description,
    path: `/blog/${post.slug}`,
    keywords: post.keywords,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <JsonLd data={articleSchema(post)} />
      {post.faqs?.length ? <JsonLd data={faqSchema(post.faqs)} /> : null}
      <p className="text-sm uppercase tracking-[0.18em] text-accent">{post.category}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{post.title}</h1>
      <p className="mt-4 text-base leading-7 text-black/68">{post.description}</p>
      <div className="mt-8 space-y-5 text-base leading-8 text-black/75">
        {post.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {post.faqs?.length ? (
        <section className="mt-12 rounded-[28px] border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">FAQ</h2>
          <div className="mt-6 space-y-5">
            {post.faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-lg font-semibold text-ink">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-black/68">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
