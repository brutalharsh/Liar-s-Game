import type { Metadata } from "next";
import { RoomsView } from "@/components/rooms/RoomsView";

export const metadata: Metadata = {
  title: "Public rooms",
  description:
    "Browse live public Liar's Game tables — open seats for 2–7 players, themes, stakes-free bluffing. See a table you like? Hop straight in.",
};

export default function RoomsPage() {
  return <RoomsView />;
}
