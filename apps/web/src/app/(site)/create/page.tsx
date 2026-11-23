import type { Metadata } from "next";
import { CreateView } from "@/components/create/CreateView";

export const metadata: Metadata = {
  title: "Create a table",
  description:
    "Open a Liar's Game table: pick a theme, capacity and visibility, then share the invite link — up to 7 players (10 with the Big Table pass).",
};

export default function CreatePage() {
  return <CreateView />;
}
