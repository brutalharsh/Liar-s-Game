"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { socket } from "@/lib/socket";
import { useGameStore } from "@/store/game";
import { useToasts } from "@/store/ui";
import { isValidRoomCode } from "@/lib/sanitize";
import { TableView } from "@/components/table/TableView";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/AsyncSection";
import { ErrorState } from "@/components/ui/AsyncSection";

/** /table/[code] client island: joins the mock room, starts the demo game. */
export function TableClient({ code }: { code: string }) {
  const router = useRouter();
  const push = useToasts();
  const lobby = useGameStore((s) => s.lobby);
  const phase = useGameStore((s) => s.phase);
  const connected = useGameStore((s) => s.connected);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!connected || joined) return;
    let cancelled = false;
    void (async () => {
      const current = useGameStore.getState().lobby;
      if (!current || current.code !== code) {
        const res = await socket.emit({ type: "room:join", code });
        if (!res.ok) {
          push({ title: res.errorMessage ?? "Couldn't join that room", tone: "bad" });
          return;
        }
      }
      if (cancelled) return;
      setJoined(true);
      const state = useGameStore.getState();
      if (state.phase === "idle" || state.phase === "lobby") {
        const res = await socket.emit({ type: "game:start" });
        if (!res.ok) push({ title: res.errorMessage ?? "Couldn't start the game", tone: "bad" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, joined, code, push]);

  if (!isValidRoomCode(code)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <ErrorState title="That room code doesn't look right" sub={`“${code}” isn't a 5-character table code.`} />
          <div className="mt-4">
            <Link href="/join" className="underline font-body text-red-text">
              Try another code
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inGame = phase !== "idle" && phase !== "lobby";

  if (!lobby || lobby.code !== code || (!inGame && !joined)) {
    return (
      <div className="stage-felt flex h-full flex-col items-center justify-center gap-4">
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-16 -ml-3 first:ml-0" />
          ))}
        </div>
        <p className="animate-pulse font-body text-sm text-ink-dim">Shuffling you in…</p>
      </div>
    );
  }

  return (
    <>
      <TableView
        code={code}
        onLeave={() => setLeaveOpen(true)}
        roomId={code}
      />
      <Sheet open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave the table?">
        <p className="mb-4 font-body text-sm text-ink-dim">
          The round keeps running without you — your seat opens up for the next drunk.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setLeaveOpen(false)}>
            STAY
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              void socket.emit({ type: "room:leave" });
              useGameStore.getState().reset();
              router.push("/rooms");
            }}
          >
            LEAVE
          </Button>
        </div>
      </Sheet>
    </>
  );
}
