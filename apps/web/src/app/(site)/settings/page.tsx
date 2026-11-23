import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Tune your Liar's Game: sound and voice volumes, captions, emote mute, reduced motion and haptics.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
