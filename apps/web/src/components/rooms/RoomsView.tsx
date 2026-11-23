"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { AsyncSection, EmptyState, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { mockFetch } from "@/lib/mock/api";
import { makePublicRooms, type PublicRoomCard } from "@/lib/mock/rooms";
import { themeMeta, THEMES } from "@/lib/mock/themes";
import { socket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import { useToasts } from "@/store/ui";

/** Public room browser (STR/02 v1): open tables, auto-expire after 10 min idle. */
export function RoomsView() {
  const router = useRouter();
  const push = useToasts();
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const query = useMockQuery<PublicRoomCard[]>(() => mockFetch(makePublicRooms()), []);

  const joinRoom = async (code: string, seats: number, capacity: number) => {
    if (seats >= capacity) {
      push({ title: "Table's full", sub: "Spectating lands with the Big Table wave.", tone: "info" });
      return;
    }
    const res = await socket.emit({ type: "room:join", code });
    if (!res.ok) {
      push({ title: res.errorMessage ?? "Couldn't join", tone: "bad" });
      return;
    }
    router.push(`/lobby/${code}`);
  };

  return (
    <div className="flex flex-col gap-6 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Public rooms</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Open tables, straight from the street. Idle rooms expire after 10 minutes.
        </p>
      </section>

      {/* filters */}
      <div className="flex flex-col gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables or hosts…"
          aria-label="Search rooms"
          className="mx-auto w-full max-w-xl rounded-btn border-2 border-wood-mid bg-wood-deep px-4 py-3 font-body text-sm text-ivory placeholder:text-ink-dim/40 focus:border-brass"
        />
        <div className="flex flex-wrap justify-center gap-1.5">
          <button
            onClick={() => setThemeFilter("all")}
            aria-pressed={themeFilter === "all"}
            className={`min-h-12 rounded-full border-2 px-3 font-body text-xs ${
              themeFilter === "all" ? "border-brass text-brass" : "border-wood-mid text-ink-dim"
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
                themeFilter === t.id ? "border-brass text-brass" : "border-wood-mid text-ink-dim"
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
        isEmpty={(rooms) => rooms.filter((r) => (themeFilter === "all" || r.theme === themeFilter) && (search === "" || r.name.toLowerCase().includes(search.toLowerCase()) || r.hostName.toLowerCase().includes(search.toLowerCase()))).length === 0}
        empty={
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
        }
      >
        {(rooms) => {
          const filtered = rooms.filter(
            (r) =>
              (themeFilter === "all" || r.theme === themeFilter) &&
              (search === "" ||
                r.name.toLowerCase().includes(search.toLowerCase()) ||
                r.hostName.toLowerCase().includes(search.toLowerCase())),
          );
          return (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((room) => (
                <Panel key={room.code} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg text-ivory">{room.name}</span>
                    <div className="flex items-center gap-1">
                      {room.locked && (
                        <span title="locked" aria-label="locked room" className="text-sm">
                          🔒
                        </span>
                      )}
                      <span className="font-body text-[10px] text-ink-dim">idle {room.idleMinutes}m</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-body text-xs text-ink-dim">
                    <span aria-hidden>👑</span> {room.hostName} hosting
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-felt-deep px-2 py-0.5 font-body text-[11px] text-lamp">
                      🎪 {themeMeta(room.theme).name}
                    </span>
                    <span className="font-display text-brass">
                      {room.seats}/{room.capacity}
                    </span>
                  </div>
                  <Button
                    variant={room.seats >= room.capacity ? "outline" : "brass"}
                    className="mt-2"
                    onClick={() => void joinRoom(room.code, room.seats, room.capacity)}
                  >
                    {room.seats >= room.capacity ? "FULL — SPECTATE" : "JOIN TABLE"}
                  </Button>
                </Panel>
              ))}
            </div>
          );
        }}
      </AsyncSection>

      <SectionTitle kicker="or bring friends">
        <span className="text-lg">Private tables never show up here</span>
      </SectionTitle>
      <p className="mx-auto max-w-md text-center font-body text-sm text-ink-dim">
        Create a private table for the group chat — the invite link IS the room key.
      </p>
    </div>
  );
}
