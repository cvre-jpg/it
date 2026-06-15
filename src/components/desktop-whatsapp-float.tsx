import { useWhatsAppNumber, DEFAULT_WHATSAPP_NUMBER } from "@/hooks/use-whatsapp-number";
import { handleWhatsAppLinkClick, waLink } from "@/lib/whatsapp";

export function DesktopWhatsAppFloat() {
  const { data: wa = DEFAULT_WHATSAPP_NUMBER } = useWhatsAppNumber();
  const href = waLink(wa, "Hello Shop ICT Gadgets, I need help with a product.");

  return (
    <div className="fixed bottom-6 right-6 z-40 hidden items-end gap-3 lg:flex">
      <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#111827] shadow-[0_20px_45px_-20px_rgba(17,24,39,0.28)]">
        Need help?
      </div>
      <a
        href={href}
        onClick={(event) => handleWhatsAppLinkClick(event, href)}
        aria-label="Message us on WhatsApp"
        className="grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_20px_45px_-18px_rgba(37,211,102,0.7)] transition-transform duration-200 hover:scale-[1.03] hover:bg-[#1fb95a]"
      >
        <img src="/whatsapp.svg" alt="" aria-hidden="true" className="h-7 w-7" />
      </a>
    </div>
  );
}
