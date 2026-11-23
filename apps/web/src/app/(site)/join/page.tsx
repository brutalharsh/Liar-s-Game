import { Suspense } from "react";
import type { Metadata } from "next";
import { JoinView } from "@/components/join/JoinView";

export const metadata: Metadata = {
  title: "Join with code",
  description:
    "Got an invite? Punch in the 5-character room code and take your seat at a Liar's Game table.",
};

export default function JoinPage() {
  // JoinView reads ?code= via useSearchParams — the Suspense boundary keeps
  // the static shell prerenderable (Next 16 App Router requirement).
  return (
    <Suspense>
      <JoinView />
    </Suspense>
  );
}
