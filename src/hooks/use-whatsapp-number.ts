import { useQuery } from "@tanstack/react-query";
import { fetchWhatsAppNumber } from "@/lib/products";

export const DEFAULT_WHATSAPP_NUMBER = "+254713869018";

export function useWhatsAppNumber() {
  return useQuery({
    queryKey: ["whatsapp-number"],
    queryFn: () => fetchWhatsAppNumber(),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}
