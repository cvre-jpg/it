import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, buildMetaDescription, buildTitle } from "@/lib/seo";

export const Route = createFileRoute("/returns-policy")({
  component: ReturnsPolicyPage,
  head: () => {
    const title = buildTitle("Returns & Exchanges Policy");
    const description = buildMetaDescription(
      "Read the Shop ICT Gadgets 3-day returns and exchanges policy, warranty terms, and conditions for previous exchanges.",
      "Shop ICT Gadgets returns and exchanges policy.",
    );

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl("/returns-policy") },
        { property: "og:image", content: absoluteUrl("/logo.png") },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: absoluteUrl("/logo.png") },
      ],
      links: [{ rel: "canonical", href: absoluteUrl("/returns-policy") }],
    };
  },
});

const policySections = [
  {
    title: "3-Day Return & Exchange Policy",
    paragraphs: [
      "Customers may request a return or exchange within 3 days from the date of purchase, provided the product is in its original condition, with all accessories, packaging and documentation intact.",
      "After the 3-day period has elapsed, we do not accept returns or exchanges based on change of mind, preference, dissatisfaction, or compatibility issues.",
    ],
  },
  {
    title: "Warranty",
    paragraphs: [
      "Our warranty remains separate from the return and exchange policy. Where applicable, products will be handled in accordance with the warranty terms provided at the time of purchase.",
      "Warranty does not cover physical damage, misuse, liquid damage, unauthorized repairs or modifications.",
    ],
  },
  {
    title: "Previous Exchanges",
    paragraphs: [
      "An exchange or replacement provided as a goodwill gesture does not extend or restart the standard 3-day return period unless expressly agreed otherwise in writing.",
    ],
  },
] as const;

function ReturnsPolicyPage() {
  return (
    <div className="site-desktop-width mx-auto px-6 py-12 md:py-16">
      <article className="mx-auto max-w-3xl">
        <header className="border-b pb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Customer policy</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Returns &amp; Exchanges Policy
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">
            At Shop ICT Gadgets, all customers are advised to inspect and test their products immediately after purchase.
          </p>
        </header>

        <div className="space-y-10 py-10">
          {policySections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-muted-foreground">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="rounded-2xl border bg-card p-6 text-sm font-medium leading-6 shadow-soft md:p-8 md:text-base">
          By purchasing from Shop ICT Gadgets, the customer acknowledges and agrees to these return, exchange and warranty terms.
        </p>
      </article>
    </div>
  );
}
