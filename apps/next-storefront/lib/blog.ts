import { BlogPost } from "@/lib/types";

const posts: BlogPost[] = [
  {
    slug: "best-monitors-for-home-office-kenya",
    title: "Best monitors for home office setups in Kenya",
    description: "How to choose a fast, sharp, ergonomic monitor for productivity, coding, study, and hybrid work.",
    publishedAt: "2026-05-20",
    readingMinutes: 6,
    category: "Buyer Guides",
    keywords: ["best monitor for office", "monitor buying guide kenya", "home office monitors"],
    body: [
      "Choosing the right monitor starts with matching screen size, resolution, and panel quality to your daily workflow.",
      "For spreadsheets, design, and multitasking, 27-inch QHD and 34-inch ultrawide displays usually offer the best balance of clarity and usable space.",
      "If your setup relies on long work sessions, prioritize low blue light modes, height adjustment, and strong text sharpness before cosmetic extras.",
    ],
    faqs: [
      {
        question: "Is 24-inch or 27-inch better for office work?",
        answer: "A 24-inch display works well for compact desks, while a 27-inch QHD monitor gives more room for documents and side-by-side apps.",
      },
      {
        question: "Do I need 4K for productivity?",
        answer: "4K helps with fine detail and larger canvases, but QHD is often the better value for mixed office use.",
      },
    ],
  },
  {
    slug: "how-to-choose-a-laptop-for-work-and-school",
    title: "How to choose a laptop for work and school",
    description: "A practical laptop buying guide covering RAM, storage, battery life, processor tiers, and portability.",
    publishedAt: "2026-05-17",
    readingMinutes: 7,
    category: "Buying Guides",
    keywords: ["laptop buying guide", "best student laptop kenya", "best work laptop"],
    body: [
      "Start with real usage patterns: web-heavy workflows need less graphics power than editing, engineering, or gaming.",
      "For most users, 16GB RAM and an SSD should be the baseline because they keep the system responsive over time.",
      "Screen quality, keyboard comfort, and charger portability usually matter more in daily life than chasing the highest CPU tier.",
    ],
  },
];

export function getAllPosts() {
  return posts;
}

export function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug) ?? null;
}
