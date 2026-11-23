import type { Metadata } from "next";
import { LobbyClient } from "@/components/lobby/LobbyClient";

export const metadata: Metadata = {
  title: "Lobby",
};

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <div className="h-[100dvh] overflow-hidden">
      <LobbyClient code={code.toUpperCase()} />
    </div>
  );
}
