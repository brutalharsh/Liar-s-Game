import type { Metadata } from "next";
import { LandingView } from "@/components/home/LandingView";

export const metadata: Metadata = {
  description:
    "A free 2–7 player party card game of Liar's Deck: throw cards, call liars, and pray the revolver clicks empty. Play on mobile or desktop web with instant invite links.",
};

export default function Home() {
  return <LandingView />;
}
