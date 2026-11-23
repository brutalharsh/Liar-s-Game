import type { Metadata } from "next";
import { JoinView } from "@/components/join/JoinView";

export const metadata: Metadata = {
  title: "Join with code",
};

export default function JoinPage() {
  return <JoinView />;
}
