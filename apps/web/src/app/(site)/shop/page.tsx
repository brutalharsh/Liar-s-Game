import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Dress the card sharp: Liar's Game coin packs, avatar outfits, themes and voice packs — all cosmetic, never odds.",
};

export default function ShopPage() {
  return <ShopView />;
}
