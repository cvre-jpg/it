import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, MessageCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { useWhatsAppNumber, DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { formatKES } from "@/lib/format";
import { buildWaMessage, openWhatsAppConversation, waLink } from "@/lib/whatsapp";
import { useState } from "react";
import { submitInquiry } from "@/lib/products";
import { toast } from "sonner";
import { buildClientAnalyticsPayload } from "@/lib/analytics-client";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart - Shop ICT Gadgets" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, setQty, removeFromCart, cartTotal, clearCart } = useStore();
  const { data: wa = DEFAULT_WHATSAPP_NUMBER } = useWhatsAppNumber();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleOrder = async () => {
    if (cart.length === 0) return;
    const message = buildWaMessage(cart.map((c) => ({ title: c.title, quantity: c.quantity, price: c.price })), name ? `From: ${name}${phone ? ` (${phone})` : ""}` : undefined);
    try {
      await submitInquiry({
        customer_name: name || null,
        customer_phone: phone || null,
        items: cart.map((c) => ({ id: c.id, title: c.title, qty: c.quantity, price: c.price })),
        total: cartTotal,
        message,
        analytics: buildClientAnalyticsPayload("/cart"),
      });
    } catch (e) { console.error(e); }
    openWhatsAppConversation(waLink(wa, message));
    toast.success("Opening WhatsApp...");
  };

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Discover gadgets you'll love.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/shop">Start shopping</Link></Button>
      </div>
    );
  }

  return (
    <div className="site-desktop-width mx-auto px-4 py-10 md:px-6">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">Cart</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {cart.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl border bg-card p-3">
              <Link to="/products/$slug" params={{ slug: item.slug }} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white">
                {item.image && <img src={item.image} alt={item.title} className="h-full w-full object-contain object-center" />}
              </Link>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link to="/products/$slug" params={{ slug: item.slug }} className="line-clamp-2 text-[13px] font-medium leading-[1.35] hover:text-primary">
                    {item.title}
                  </Link>
                  <div className="mt-1 text-[12px] font-medium text-muted-foreground">{formatKES(item.price)}</div>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-0.5 rounded-full border p-0.5">
                    <button onClick={() => setQty(item.id, item.quantity - 1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-surface"><Minus className="h-3 w-3" /></button>
                    <span className="w-5 text-center text-[12px] font-medium">{item.quantity}</span>
                    <button onClick={() => setQty(item.id, item.quantity + 1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-surface"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-primary"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={clearCart} className="text-sm text-muted-foreground hover:text-primary">Clear cart</button>
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-4 shadow-soft">
          <h3 className="text-base font-semibold">Order summary</h3>
          <div className="mt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatKES(cartTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>Calculated on WhatsApp</span></div>
          </div>
          <div className="mt-3 flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span>{formatKES(cartTotal)}</span></div>

          <div className="mt-4 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="w-full rounded-full border bg-background px-3.5 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full rounded-full border bg-background px-3.5 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <Button onClick={handleOrder} size="lg" className="mt-4 h-10 w-full rounded-full bg-whatsapp px-3 text-[13px] text-whatsapp-foreground hover:bg-whatsapp/90">
            <MessageCircle className="h-3.5 w-3.5" /> Proceed to WhatsApp Order
          </Button>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">No online payment — confirm your order on WhatsApp.</p>
        </aside>
      </div>
    </div>
  );
}
