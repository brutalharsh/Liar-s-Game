import type { Metadata } from "next";
import { MotionLab } from "@/components/game/MotionLab";

export const metadata: Metadata = {
  title: "Motion Lab",
  robots: { index: false, follow: false },
};

/**
 * DEV-ONLY cinematic test bench (W2): renders the REAL table components
 * reading the REAL store — each button applies canned, schema-valid shared
 * events, so every beat previews through the production code path.
 * Not linked from anywhere; intended for the motion pass + C1 audio wiring.
 */
export default function MotionLabPage() {
  return <MotionLab />;
}
