import { createFileRoute } from "@tanstack/react-router";
import { Phone, Mail, MapPin, MessageCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWhatsAppNumber, DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { handleWhatsAppLinkClick, openWhatsAppConversation, waLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import { absoluteUrl, buildMetaDescription, buildTitle } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => {
    const title = buildTitle("Contact");
    const description = buildMetaDescription(
      "Reach Shop ICT Gadgets in Kenya. Visit our store, call, email, or chat with us on WhatsApp for fast electronics support.",
      "Reach Shop ICT Gadgets.",
    );

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl("/contact") },
        { property: "og:image", content: absoluteUrl("/logo.png") },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: absoluteUrl("/logo.png") },
      ],
      links: [{ rel: "canonical", href: absoluteUrl("/contact") }],
    };
  },
});

function ContactPage() {
  const { data: wa = DEFAULT_WHATSAPP_NUMBER } = useWhatsAppNumber();
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Hello Shop ICT Gadgets, my name is ${form.name} (${form.email}).\n\n${form.message}`;
    openWhatsAppConversation(waLink(wa, text));
    toast.success("Opening WhatsApp...");
  };
  const supportHref = waLink(wa, "Hello Shop ICT Gadgets!");

  return (
    <div className="site-desktop-width mx-auto px-6 py-12">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Talk to us.</h1>
        <p className="mt-3 text-muted-foreground">We respond within minutes during business hours. Prefer chat? Tap WhatsApp.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-card p-6 md:p-8 shadow-soft">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Message</label>
            <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90">
            <MessageCircle className="h-4 w-4" /> Send via WhatsApp
          </Button>
        </form>

        <div className="space-y-4">
          <a href={supportHref} onClick={(event) => handleWhatsAppLinkClick(event, supportHref)} className="block overflow-hidden rounded-3xl gradient-primary p-8 text-primary-foreground hover-lift">
            <MessageCircle className="h-8 w-8" />
            <h3 className="mt-4 text-2xl font-bold">WhatsApp support</h3>
            <p className="mt-1 opacity-90">Fast replies, real humans. Tap to chat now.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm">{wa}</div>
          </a>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5"><Phone className="h-5 w-5 text-primary" /><div className="mt-3 text-sm font-semibold">Call us</div><div className="text-xs text-muted-foreground">+254 713 869 018</div></div>
            <div className="rounded-2xl border bg-card p-5"><Mail className="h-5 w-5 text-primary" /><div className="mt-3 text-sm font-semibold">Email</div><div className="text-xs text-muted-foreground">hello@shopict.co.ke</div></div>
            <div className="rounded-2xl border bg-card p-5"><MapPin className="h-5 w-5 text-primary" /><div className="mt-3 text-sm font-semibold">Visit</div><div className="text-xs text-muted-foreground">Nairobi, Kenya</div></div>
            <div className="rounded-2xl border bg-card p-5"><Clock className="h-5 w-5 text-primary" /><div className="mt-3 text-sm font-semibold">Hours</div><div className="text-xs text-muted-foreground">Mon–Sat 9am–6pm</div></div>
          </div>
          <div className="overflow-hidden rounded-3xl border">
            <iframe title="Map" src="https://www.google.com/maps?q=Nairobi&output=embed" className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
