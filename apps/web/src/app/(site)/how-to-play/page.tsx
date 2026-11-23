import type { Metadata } from "next";
import { HowToPlayView } from "@/components/howto/HowToPlayView";

export const metadata: Metadata = {
  title: "How to play",
  description:
    "Liar's Deck house rules: the deal, the throw, calling liar, the reveal, and the six-chamber revolver.",
};

export default function HowToPlay() {
  return <HowToPlayView />;
}
