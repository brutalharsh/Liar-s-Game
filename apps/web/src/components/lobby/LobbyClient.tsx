"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { socket, socketMode } from "@/lib/socket";
import { useGameStore } from "@/store/game";
import { useToasts } from "@/store/ui";
import { isValidRoomCode } from "@/lib/sanitize";
import { themeIdFromSlug } from "@/components/rooms/theme-slug";
import { GameTableShell } from "@/components/game/GameTableShell";
import { Panel } from "@/components/ui/Panel";
import { InviteChip } from "@/components/ui/InviteChip";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton, ErrorState } from "@/components/ui/AsyncSection";
import { BotIcon, CoinIcon, CrownIcon, LockIcon, LockOpenIcon, RulesIcon, ThemeIcon } from "@/components/ui/icons";
import { themeMeta, THEMES } from "@/lib/mock/themes";
import { QUICK_RULES } from "@/lib/mock/rules-content";
import type { SeatView, ThemeId } from "@/lib/wire";

/** 
 * /lobby/[code] client island — joins the room, shows the waiting table.
 * Live notes (S1): host lock/kick/bot-fill have NO wire events (programmatic
 * only), so those controls render ONLY in mock mode; the phase flipping past
 * lobby navigates to the table route (GameBridge owns re-sync once there).
 */
export function LobbyClient({ code }: { code: string }) {
  const router = useRouter();
  const push = useToasts();
  const lobby = useGameStore((s) => s.lobby);
  const connected = useGameStore((s) => s.connected);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const spectator = useGameStore((s) => s.spectator);
  const startGame = useGameStore((s) => s.startGame);
  const live = socketMode() === "live";
  const [joined, setJoined] = useState(false);
  const [sheet, setSheet] = useState<null | "theme" | "rules" | { kick: SeatView }>(null);
  const [started, setStarted] = useState(false);

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
        if (res.spectator) {
          push({ title: "Table's full — spectating from the rail", tone: "info" });
        }
      }
      if (!cancelled) setJoined(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, joined, code, push]);

  // phase flip past lobby → the table route (round:new, or a catch-up
  // snapshot that shows the match already live — a reconnected seat)
  useEffect(() => {
    const goTable = (): void => {
      router.push(`/table/${code}`);
    };
    const off = socket.on((ev) => {
      if (ev.event === "round:new") {
        goTable();
        return;
      }
      if (ev.event === "lobby:state" && ev.payload.roomCode === code && ev.payload.phase !== "lobby") {
        goTable();
      }
    });
    return off;
  }, [code, router]);

  if (!isValidRoomCode(code)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <ErrorState title="That room code doesn't look right" sub={`“${code}” isn't a valid 5-character code.`} />
          <div className="mt-4">
            <Link href="/join" className="font-body text-sm text-brass underline">
              Try another code
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!lobby || lobby.code !== code) {
    return (
      <div className="stage-felt flex h-full flex-col items-center justify-center gap-4">
        <div className="flex gap-2" aria-label="Loading seats">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-20 rounded-full" />
          ))}
        </div>
        <p className="animate-pulse font-body text-sm text-ink-dim">Walking over to table {code}…</p>
      </div>
    );
  }

  const displayTheme = themeIdFromSlug(lobby.theme);
  const seated = lobby.seats.filter((s) => s.nickname !== null);
  const isHost = !spectator && heroSeat === lobby.hostSeat;
  const canStart = live ? isHost && seated.length >= 2 && !started : seated.length >= 2 && !started;

  const onStart = () => {
    setStarted(true);
    void startGame().then((res) => {
      if (!res.ok) {
        setStarted(false);
        push({ title: startErrorTitle(res.errorCode), sub: res.errorMessage, tone: "bad" });
        return;
      }
      router.push(`/table/${code}`);
    });
  };

  return (
    <>
      <GameTableShell
        seats={lobby.seats}
        heroSeat={spectator ? -1 : heroSeat}
        variant="lobby"
        topStrip={
          <div className="flex min-h-12 items-center gap-2 border-b-2 border-wood-mid/70 bg-wood/85 px-3 pt-safe">
            <button
              onClick={() => {
                void socket.emit({ type: "room:leave" });
                useGameStore.getState().reset();
                router.push("/rooms");
              }}
              aria-label="Leave lobby"
              className="flex h-12 w-12 items-center justify-center rounded-full text-xl text-ink-dim hover:text-blood-bright"
            >
              ←
            </button>
            <h1 className="truncate font-display text-sm tracking-wider text-ivory">{lobby.name}</h1>
            <span className="ml-auto rounded-full border border-brass-deep bg-wood-deep px-2 py-0.5 font-body text-[10px] uppercase text-brass">
              {lobby.visibility}
            </span>
            {spectator && (
              <span className="rounded-full border border-blood/60 bg-wood-deep px-2 py-0.5 font-body text-[10px] uppercase text-blood-bright">
                spectating
              </span>
            )}
          </div>
        }
        contextRibbon={
          <span className="inline-flex items-center">
            {seated.length}/{lobby.capacity} SEATED · {themeMeta(displayTheme).name.toUpperCase()}
            {!live && (
              <>
                {lobby.roomLocked ? (
                  <span className="ml-1 inline-flex items-center gap-0.5">
                    <LockIcon size={12} className="text-brass" /> LOCKED
                  </span>
                ) : (
                  " · OPEN"
                )}
              </>
            )}
          </span>
        }
        pile={
          <Panel tone="felt" className="max-w-xs p-4 text-center">
            <p className="font-body text-[10px] uppercase tracking-widest text-lamp">Host theme</p>
            <p className="mt-1 font-display text-xl text-ivory">{themeMeta(displayTheme).name}</p>
            <p className="mt-1 font-body text-[11px] text-ink-dim">{themeMeta(displayTheme).desc}</p>
            <div
              className="mx-auto mt-3 h-10 w-full rounded-btn border border-wood-mid"
              style={{
                background: `linear-gradient(135deg, ${themeMeta(displayTheme).swatch.felt}, ${themeMeta(displayTheme).swatch.wood})`,
              }}
              aria-hidden
            />
          </Panel>
        }
        banner={
          <span className="font-display text-sm tracking-widest text-brass">
            {spectator
              ? "SPECTATING — SEATS OPEN UP AS PLAYERS LEAVE"
              : "WAITING FOR PLAYERS — FIRST THROW LANDS SOON"}
          </span>
        }
        bottomBar={
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 pb-3">
            {/* invite row */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <InviteChip code={lobby.code} origin={typeof window === "undefined" ? "" : window.location.origin} />
            </div>

            {/* checklist of players */}
            <Panel tone="wood" className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-body text-xs uppercase tracking-widest text-lamp">Players</p>
                <span className="font-display text-sm text-brass">
                  {seated.length}/{lobby.capacity}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {seated.map((seat) => (
                  <li key={seat.seat} className="flex min-h-12 items-center gap-2">
                    <Avatar spec={seat.avatar} size="sm" />
                    <span className="font-display text-base text-ivory">
                      {seat.nickname}
                      {!spectator && seat.seat === heroSeat && <em className="ml-1 not-italic text-xs text-brass">(you)</em>}
                    </span>
                    {seat.isBot && (
                      <span aria-label="bot player" className="inline-flex items-center gap-1 font-body text-[10px] uppercase text-lamp">
                        <BotIcon size={12} /> bot
                      </span>
                    )}
                    {seat.isHost && <CrownIcon size={14} label="host" className="text-brass" />}
                    <span
                      className={`ml-auto font-body text-[10px] ${
                        seat.connected ? "text-verdict" : "text-ink-dim"
                      }`}
                    >
                      {seat.connected ? "● seated" : "○ joining…"}
                    </span>
                    {!live && seat.seat !== 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSheet({ kick: seat })} aria-label={`Kick ${seat.nickname}`}>
                        KICK
                      </Button>
                    )}
                    {!live && (
                      <Button
                        variant="ghost"
                        onClick={() => useGameStore.getState().toggleSeatLock(seat.seat)}
                        aria-label={`Lock seat ${seat.seat + 1}`}
                        className="px-3"
                      >
                        {seat.locked ? <LockIcon size={16} label="seat locked" /> : <LockOpenIcon size={16} label="seat open" />}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>

            {/* meta chips + host controls */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-lamp/50 bg-lamp/10 px-3 py-1 font-body text-xs text-lamp">
                ~{lobby.estMatchMinutes} min at {seated.length}
                {seated.length === 1 ? " player" : " players"}
              </span>
              {!live && (
                <Button variant="outline" size="sm" onClick={() => useGameStore.getState().fillSeatWithBot()}>
                  <span className="inline-flex items-center gap-2">
                    <BotIcon size={16} />
                    BOT FILLS A SEAT
                  </span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSheet("rules")}>
                <span className="inline-flex items-center gap-2">
                  <RulesIcon size={16} />
                  RULES
                </span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSheet("theme")}>
                <span className="inline-flex items-center gap-2">
                  <ThemeIcon size={16} />
                  THEME
                </span>
              </Button>
            </div>

            {spectator ? (
              <p className="text-center font-body text-sm text-ink-dim">Spectating — a seat opens the moment one frees up.</p>
            ) : live && !isHost ? (
              <p className="inline-flex items-center gap-1 text-center font-body text-sm text-ink-dim">
                Waiting for the host to deal… <CrownIcon size={14} className="text-brass" />
              </p>
            ) : (
              <Button variant="brass" size="big" className="text-xl" disabled={!canStart} onClick={onStart}>
                {started ? "DEALING…" : seated.length < 2 ? "WAITING FOR 1 MORE PLAYER…" : "START TABLE — YOUR CALL FIRST"}
              </Button>
            )}
          </div>
        }
        aside={
          <>
            <Panel tone="deep" className="p-3">
              <p className="font-body text-xs uppercase tracking-widest text-lamp">Invite</p>
              <p className="mt-1 font-display text-3xl tracking-[0.3em] text-brass">{lobby.code}</p>
              <p className="mt-1 font-body text-[11px] text-ink-dim">Share the link — code doubles as the room secret.</p>
            </Panel>
            <Panel tone="deep" className="p-3">
              <p className="mb-2 font-body text-xs uppercase tracking-widest text-lamp">House rules</p>
              <ul className="flex flex-col gap-1">
                {QUICK_RULES.map((rule) => (
                  <li key={rule} className="font-body text-[11px] text-ink-dim">
                    · {rule}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel tone="deep" className="p-3">
              <p className="mb-2 font-body text-xs uppercase tracking-widest text-lamp">Match time</p>
              <p className="font-body text-sm text-ivory">
                ~{lobby.estMatchMinutes} min at {Math.max(2, seated.length)} players
              </p>
            </Panel>
          </>
        }
        onSeatTap={(seat) => {
          if (seat.nickname === null && !seat.locked) {
            void navigator.clipboard?.writeText(`${window.location.origin}/r/${lobby.code}`).then(() =>
              push({ title: "Invite link copied", tone: "good" }),
            );
          } else if (!live && seat.nickname && seat.seat !== 0) {
            setSheet({ kick: seat });
          }
        }}
      />

      {/* theme sheet */}
      <Sheet open={sheet === "theme"} onClose={() => setSheet(null)} title="Pick a table theme">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((theme) => {
            const current = displayTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  if (live) {
                    push({ title: "Theme swaps arrive with host controls", sub: "For now the host's pick stands.", tone: "info" });
                    return;
                  }
                  if (!theme.free) {
                    push({ title: `${theme.name} costs ${theme.price} coins`, sub: "Unlock it in the Shop", tone: "info" });
                    return;
                  }
                  useGameStore.getState().setTheme(theme.id as ThemeId);
                }}
                className={`flex min-h-16 flex-col items-start gap-1 rounded-card border-2 p-3 text-left ${
                  current ? "border-brass bg-brass/10" : theme.free ? "border-wood-mid bg-wood/50 hover:border-brass" : "border-wood-mid/40 bg-wood-deep/50 opacity-60"
                }`}
              >
                <span className="font-display text-base text-ivory">{theme.name}</span>
                <span className="inline-flex items-center gap-1 font-body text-[10px] text-ink-dim">
                  {theme.free ? "FREE" : (<><CoinIcon size={12} /> {theme.price}</>)}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* rules drawer */}
      <Sheet open={sheet === "rules"} onClose={() => setSheet(null)} title="Table rules">
        <ul className="flex flex-col gap-2">
          {QUICK_RULES.map((rule, i) => (
            <li key={rule} className="flex items-start gap-2 font-body text-sm text-ivory">
              <span className="font-display text-brass">{i + 1}.</span>
              {rule}
            </li>
          ))}
        </ul>
        <Link href="/how-to-play" className="mt-4 block font-body text-sm text-brass underline">
          Full rules →
        </Link>
      </Sheet>

      {/* kick confirm (mock-dev host control — no live wire event) */}
      <Sheet
        open={!live && sheet !== null && typeof sheet === "object" && "kick" in sheet}
        onClose={() => setSheet(null)}
        title={`Kick ${typeof sheet === "object" && sheet && "kick" in sheet ? sheet.kick.nickname : ""}?`}
      >
        <p className="mb-4 font-body text-sm text-ink-dim">
          Their seat opens up immediately. No hard feelings — it's a bluffing game.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setSheet(null)}>
            KEEP THEM
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              if (!live && typeof sheet === "object" && sheet && "kick" in sheet) {
                useGameStore.getState().kickSeat(sheet.kick.seat);
                push({ title: `${sheet.kick.nickname} was shown the door`, tone: "info" });
              }
              setSheet(null);
            }}
          >
            KICK
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** game:start rejection codes → friendly copy (router is the authority). */
function startErrorTitle(errorCode?: string): string {
  switch (errorCode) {
    case "INSUFFICIENT_PLAYERS":
      return "Need at least 2 seated";
    case "NOT_HOST":
      return "Only the host deals";
    case "NOT_IN_ROOM":
      return "You're not in a room";
    case "ILLEGAL_MOVE":
      return "The table's already dealing";
    case "AUTH_REQUIRED":
      return "Login to deal";
    default:
      return "Couldn't start the table";
  }
}
