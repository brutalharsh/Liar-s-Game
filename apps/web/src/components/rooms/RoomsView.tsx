"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { AsyncSection, EmptyState, Skeleton } from "@/components/ui/AsyncSection";
import { useRoomsPoll } from "@/components/rooms/useRoomsPoll";
import { themeIdFromSlug } from "@/components/rooms/theme-slug";
import { joinErrorCopy, joinRoomByCode } from "@/components/join/join-flow";
import type { PublicRoomRow } from "@/lib/api";
import { themeMeta, THEMES } from "@/lib/mock/themes";
import { socketMode } from "@/lib/socket";
import { sanitizeRoomCode } from "@/lib/sanitize";
import { useRouter } from "next/navigation";
import { useToasts } from "@/store/ui";

/** Public room browser (STR/02 v1): live GET /api/rooms rows, ~10s visible-tab poll. */
export function RoomsView() {
  const router = useRouter();
  const push = useToasts();
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [joinCode, setJoinCode] = useState("");
  const [joinPending, setJoinPending] = useState(false);
  const query = useRoomsPoll({ page: 1, perPage: 24 });
  const live = socketMode() === "live";

  const submitJoin = async (rawCode: string): Promise<void> => {
    const code = sanitizeRoomCode(rawCode);
    if (code.length !== 5) {
      push({ title: "Codes are 5 characters", sub: "A–Z and 2–9, no I/L/O/0/1.", tone: "bad" });
      return;
    }
    setJoinPending(true);
    const outcome = await joinRoomByCode(code);
    setJoinPending(false);
    if (!outcome.ok) {
      const copy = joinErrorCopy(outcome.errorCode);
      push({ title: copy.title, sub: copy.sub, tone: "bad" });
      return;
    }
    if (outcome.spectator) {
      push({ title: "That table's packed — spectating", sub: "You'll get a seat-line seat the moment one opens.", tone: "info" });
    }
    router.push(`/${outcome.destination}/${code}`);
  };

  const joinRoom = async (room: PublicRoomRow): Promise<void> => {
    if (room.seatsTaken >= room.capacity) {
      push({ title: "Full table — pulling up a rail seat", sub: "You'll spectate until a chair opens.", tone: "info" });
    }
    const res = await joinRoomByCode(room.roomCode);
    if (!res.ok) {
      const copy = joinErrorCopy(res.errorCode);
      push({ title: copy.title, sub: copy.sub, tone: "bad" });
      return;
    }
    if (res.spectator) {
      push({ title: "That table's packed — spectating", sub: "You'll get a seat the moment one opens.", tone: "info" });
    }
    router.push(`/${res.destination}/${room.roomCode}`);
  };

  const visible = (room: PublicRoomRow): boolean => {
    const needle = search.toLowerCase();
    return (
      (themeFilter === "all" || themeIdFromSlug(room.theme) === themeFilter) &&
      (needle === "" ||
        room.name.toLowerCase().includes(needle) ||
        room.hostNickname.toLowerCase().includes(needle))
    );
  };

  return (
    <div className="flex flex-col gap-6 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Public rooms</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Open tables, straight from the street. Idle rooms expire after 10 minutes.
        </p>
      </section>

      {/* join by code — same flow as /join */}
      <Panel tone="deep" className="mx-auto flex w-full max-w-md flex-col gap-2 p-4">
        <label htmlFor="rooms-join-code" className="font-body text-xs uppercase tracking-widest text-lamp">
          Have a code?
        </label>
        <div className="flex gap-2">
          <input
            id="rooms-join-code"
            value={joinCode}
            onChange={(e) => setJoinCode(sanitizeRoomCode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitJoin(joinCode);
            }}
            placeholder="ABCDE"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={5}
            aria-label="Room code"
            className="min-h-12 flex-1 rounded-btn border-2 border-wood-mid bg-wood-deep px-4 font-display text-xl tracking-[0.25em] text-brass placeholder:text-ink-dim/70 focus:border-brass"
          />
          <Button variant="brass" disabled={joinPending || joinCode.length !== 5} onClick={() => void submitJoin(joinCode)}>
            {joinPending ? "JOINING…" : "JOIN"}
          </Button>
        </div>
      </Panel>

      {/* filters */}
      <div className="flex flex-col gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables or hosts…"
          aria-label="Search rooms"
          className="mx-auto w-full max-w-xl rounded-btn border-2 border-wood-mid bg-wood-deep px-4 py-3 font-body text-sm text-ivory placeholder:text-ink-dim/70 focus:border-brass"
        />
        <div className="flex flex-wrap justify-center gap-1.5">
          <button
            onClick={() => setThemeFilter("all")}
            aria-pressed={themeFilter === "all"}
            className={`min-h-12 rounded-full border-2 px-3 font-body text-xs ${
              themeFilter === "all" ? "border-brass text-red-text" : "border-wood-mid text-ink-dim"
            }`}
          >
            ALL THEMES
          </button>
          {THEMES.filter((t) => t.free).concat(THEMES.filter((t) => !t.free)).map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeFilter(t.id)}
              aria-pressed={themeFilter === t.id}
              className={`min-h-12 rounded-full border-2 px-3 font-body text-xs ${
                themeFilter === t.id ? "border-brass text-red-text" : "border-wood-mid text-ink-dim"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <AsyncSection
        query={query}
        errorTitle="The street's closed"
        skeleton={
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        }
        isEmpty={(page) => page.rooms.filter(visible).length === 0}
        empty={
          search !== "" || themeFilter !== "all" ? (
            <EmptyState
              icon="🔍"
              title="Nothing on the board matches"
              sub="No public table fits that hunt — clear the filters, or deal your own."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setThemeFilter("all");
                  }}
                >
                  CLEAR FILTERS
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="🎪"
              title="Nothing dealing right now"
              sub="Every public table vanished while you blinked. Open one!"
              action={
                <a href="/create" className="flex min-h-12 items-center rounded-btn border-2 border-brass bg-brass px-5 font-display text-wood-deep">
                  CREATE A TABLE
                </a>
              }
            />
          )
        }
      >
        {(page) => (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {page.rooms.filter(visible).map((room) => {
              const full = room.seatsTaken >= room.capacity;
              return (
                <Panel key={room.roomCode} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg text-ivory">{room.name}</span>
                    <div className="flex items-center gap-1">
                      {room.locked && (
                        <span title="locked" aria-label="locked room" className="text-sm">
                          🔒
                        </span>
                      )}
                      {room.idleMinutes !== undefined && (
                        <span className="font-body text-[10px] text-ink-dim">idle {room.idleMinutes}m</span>
                      )}
                      <span className="font-body text-[10px] text-ink-dim">{room.roomCode}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-body text-xs text-ink-dim">
                    <span aria-hidden>👑</span> {room.hostNickname} hosting
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-felt-deep px-2 py-0.5 font-body text-[11px] text-lamp">
                      🎪 {themeMeta(themeIdFromSlug(room.theme)).name}
                    </span>
                    <span className="font-display text-red-text" aria-label={`${room.seatsTaken} of ${room.capacity} seats taken`}>
                      {room.seatsTaken}/{room.capacity}
                    </span>
                  </div>
                  <Button variant={full ? "outline" : "brass"} className="mt-2" onClick={() => void joinRoom(room)}>
                    {full ? "FULL — SPECTATE" : "JOIN TABLE"}
                  </Button>
                </Panel>
              );
            })}
          </div>
        )}
      </AsyncSection>

      <SectionTitle kicker="or bring friends">
        <span className="text-lg">Private tables never show up here</span>
      </SectionTitle>
      <p className="mx-auto max-w-md text-center font-body text-sm text-ink-dim">
        Create a private table for the group chat — the invite link IS the room key.
      </p>
      {live && (
        <p className="mx-auto max-w-md text-center font-body text-[11px] text-ink-dim">
          Live list — refreshes about every 10 seconds while this tab is front and centre.
        </p>
      )}
    </div>
  );
}
