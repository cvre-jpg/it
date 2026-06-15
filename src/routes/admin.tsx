import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin - Shop ICT Gadgets" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
