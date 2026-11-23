"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { useGameStore } from "@/store/game";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { vibrate } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { emojiForSpec } from "@/lib/mock/avatar";
import { nicknameOfStore } from "@/components/game/shot/shotView";
import {
  blankSchedule,
  liveSchedule,
  shotBuildSchedule,
  shotBuildScheduleShort,
  type ShotBeat,
} from "@/motion/shot";
import { Revolver } from "@/components/game/shot/Revolver";

/**
 * ============================================================================
 * SHOT CINEMATIC — the centerpiece (STR/05 §4, research/09 §4)
 * ============================================================================
 * SELF:    spotlight narrows → revolver rises + glides (600ms) → CYLINDER
 *          BLUR-SPIN 1.2s → HAMMER COCK + stage zoom → DEAD AIR → hold for the
 *          server's `shot:result`:
 *   BLANK → dry click · 600ms silence · Zimmermann head-fake (the whole
 *           stage lurches toward a BANG that never comes) · slow settle ·
 *           ✓ SURVIVED stamp + PHEW
 *   LIVE  → muzzle flash 80ms · screen shake ±6px 400ms · slam-to-black
 *           ~150ms · PG-13 slump + gray-out → ✖ ELIMINATED stamp
 * EXECUTE: accuser's revolver slides in from the left, target-lock reticle
 *          shutters closed on the loser, 8Hz fear-tremor, same pull beat.
 *          Full sequence ≈3.4s; Reduced-motion: stepped text beats, no
 *          translate/rotate/shake (a red vignette flash stands in for the
 *          bang — research/09 §6). No gore, ever.
 * ============================================================================
 */

const AFTER_COCK: ReadonlySet<ShotBeat> = new Set(["cock", "air", "hold", "dryclick", "fake", "settle", "flash", "black", "slump"]);
/** The revolver lives on stage from the `enter` beat on (B.enter = 500ms). */
const REVOLVER_ON: ReadonlySet<ShotBeat> = new Set(["enter", "reticle", "spin", "cock", "air", "hold", "dryclick", "fake", "settle", "flash", "black", "slump"]);
/** Dead-air push holds from `air` through the payoff, releasing on settle/slump. */
const AIR_ON: ReadonlySet<ShotBeat> = new Set(["air", "hold", "dryclick", "fake", "flash", "black"]);

/** Caption ladder — every beat as text (deaf + reduced-motion text-ladder, §5). */
const CAPTIONS: Record<ShotBeat, string> = {
  dim: "the lights go down.",
  enter: "the revolver comes out.",
  reticle: "no way out now.",
  spin: "the cylinder spins…",
  cock: "hammer cocked.",
  air: "the room goes still.",
  hold: "…",
  dryclick: "click.",
  fake: "",
  settle: "PHEW.",
  flash: "BANG.",
  black: "",
  slump: "it's over.",
};

function beatEffect(beat: ShotBeat, reduced: boolean): void {
  switch (beat) {
    case "spin":
      playSfx("cylinder-spin");
      return;
    case "cock":
      playSfx("hammer-cock");
      vibrate("cock", reduced);
      return;
    case "dryclick":
      playSfx("dry-click");
      vibrate("blank", reduced);
      return;
    case "settle":
      playSfx("survive");
      return;
    case "flash":
      playSfx("bang");
      vibrate("live", reduced);
      return;
    case "slump":
      playSfx("death");
      return;
    default:
      return;
  }
}

export function ShotCinematic() {
  const shot = useGameStore((s) => s.shot);
  const phase = useGameStore((s) => s.phase);
  const roundNo = useGameStore((s) => s.roundNo);
  const heroSeat = useGameStore((s) => s.heroSeat);
  const loserEmoji = useGameStore((s) =>
    s.shot ? emojiForSpec(s.seatByNumber(s.shot.loserSeat)?.avatar ?? null) : "🔫",
  );
  const reduced = usePrefersReducedMotion();
  const [beat, setBeat] = useState<ShotBeat | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const shotId = shot ? `${roundNo}:${shot.loserSeat}:${shot.kind}` : "";

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  // build beats: dim → enter → reticle → spin → cock → air → hold (server decides)
  useEffect(() => {
    if (phase !== "shot" || !shot) return undefined;
    clearTimers();
    setBeat("dim");
    const schedule = reduced ? shotBuildScheduleShort : shotBuildSchedule;
    for (const s of schedule) {
      timers.current.push(
        setTimeout(() => {
          setBeat(s.beat);
          beatEffect(s.beat, reduced);
        }, s.at),
      );
    }
    // reset the ladder between shots — the next overlay must never flash the
    // previous shot's final frame (stamp/revolver) on its first paint.
    return () => {
      clearTimers();
      setBeat(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shotId, reduced]);

  // payoff beats: `shot:result` arrives → fork BLANK vs LIVE
  useEffect(() => {
    if (phase !== "shot" || !shot || shot.outcome === null) return undefined;
    clearTimers();
    const schedule = shot.outcome === "BLANK" ? blankSchedule : liveSchedule;
    for (const s of schedule) {
      timers.current.push(
        setTimeout(() => {
          setBeat(s.beat);
          beatEffect(s.beat, reduced);
        }, s.at),
      );
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shot?.outcome, reduced]);

  // NOTE: every hook must run before the `if (!shot) return null` bail below —
  // a shot:assign landing on a live page must never change the hook count.

  const spinning = beat === "spin";
  const cocked = beat !== null && AFTER_COCK.has(beat);
  const isExecute = shot !== null && shot.kind === "EXECUTE";
  const tremor = isExecute && beat !== null && ["reticle", "spin", "cock", "air", "hold"].includes(beat);

  // stage motion: shake (LIVE) · head-fake lurch + relief (BLANK)
  const stageAnimate = useMemo(() => {
    if (reduced) return { x: 0, y: 0, rotate: 0, scale: 1 };
    if (beat === "flash") return { x: [0, -6, 6, -4, 4, -2, 0], y: [0, 4, -4, 3, -3, 2, 0] };
    if (beat === "fake") return { y: 22, rotate: 6, scale: 1.12, x: 0 };
    if (beat === "settle") return { y: 0, rotate: 0, scale: 1, x: 0 };
    return { x: 0, y: 0, rotate: 0, scale: 1 };
  }, [beat, reduced]);

  const stageTransition = useMemo<Transition>(() => {
    if (beat === "flash") return { duration: 0.4 };
    if (beat === "fake") return { duration: 0.15, ease: "easeIn" };
    if (beat === "settle") return { duration: 0.9, ease: "easeOut" };
    return { duration: 0.25 };
  }, [beat]);

  // loser nameplate: fear-tremor loop, then the slump + gray-out on death
  const nameplateAnimate = useMemo(() => {
    if (!reduced && beat === "slump") return { x: 0, rotate: 9, y: 26, filter: "grayscale(0.85) sepia(0.28)" };
    if (!reduced && tremor) return { x: [0, 2, -2, 1, -1, 0], y: 0, rotate: 0 };
    return { x: 0, y: 0, rotate: 0 };
  }, [beat, tremor, reduced]);

  const nameplateTransition: Transition =
    tremor && !reduced ? { duration: 0.5, repeat: Infinity, repeatDelay: 0.08 } : { duration: 0.6, ease: "easeOut" };

  if (!shot) return null;

  const isLive = shot.outcome === "LIVE";
  const heroLoses = shot.loserSeat === heroSeat;
  const loserName = nicknameOfStore(shot.loserSeat);
  const executorName = shot.executorSeat !== null ? nicknameOfStore(shot.executorSeat) : "";
  const active = phase === "shot";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={shotId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          aria-live="assertive"
        >
          {/* spotlight vignette — narrows onto the loser's stage (t=0) */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 380px 300px at 50% 44%, rgb(0 0 0/0) 0%, rgb(0 0 0/0.55) 60%, rgb(0 0 0/0.88) 100%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: beat === null ? 0 : 1 }}
            transition={{ duration: 0.35 }}
          />

          {/* dead-air push (t≈2.55) — holds through the payoff, releases with the settle/slump */}
          <AnimatePresence>
            {beat !== null && AIR_ON.has(beat) && (
              <motion.div
                key="air-push"
                className="absolute inset-0 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: reduced ? 0.15 : 0.25 }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0.15 : 0.35, ease: "easeOut" } }}
                transition={{ duration: 0.35 }}
              />
            )}
          </AnimatePresence>

          {/* reduced-motion LIVE: red border flash stands in for shake+bang */}
          {reduced && beat === "flash" && (
            <motion.div
              className="absolute inset-0 border-8 border-blood-bright"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.5 }}
            />
          )}

          {/* the stage group — shakes on LIVE, head-fakes on BLANK */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-3 px-6"
            animate={stageAnimate}
            transition={stageTransition}
          >
            <motion.div
              className="relative flex flex-col items-center gap-1 rounded-card border-2 border-blood-bright/70 bg-wood-deep/90 px-5 py-3 text-center shadow-panel"
              animate={nameplateAnimate}
              transition={nameplateTransition}
            >
              <span className="text-4xl" aria-hidden>
                {loserEmoji}
              </span>
              <span className="font-display text-lg tracking-wider text-ivory">{loserName}</span>
              <span className="font-body text-xs text-ink-dim">
                {isExecute && !cocked
                  ? `in ${executorName}'s sights`
                  : isExecute
                    ? `${executorName} pulls the trigger`
                    : heroLoses
                      ? "your finger on the trigger"
                      : "takes the revolver"}
              </span>

              {/* target-lock reticle (EXECUTE) — brackets shutter closed on the loser */}
              {isExecute && beat !== null && ["reticle", "spin", "cock", "air", "hold", "dryclick", "flash"].includes(beat) && (
                <motion.span
                  className="absolute -inset-3"
                  initial={{ opacity: 0, scale: reduced ? 1 : 2.2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  aria-hidden
                >
                  {[
                    "left-0 top-0 border-l-4 border-t-4",
                    "right-0 top-0 border-r-4 border-t-4",
                    "left-0 bottom-0 border-b-4 border-l-4",
                    "right-0 bottom-0 border-b-4 border-r-4",
                  ].map((cls) => (
                    <span key={cls} className={`absolute h-4 w-4 border-blood-bright ${cls}`} />
                  ))}
                </motion.span>
              )}
            </motion.div>

            {/* revolver rises (SELF, at `enter`=500ms) or slides in accuser-side (EXECUTE) */}
            {beat !== null && REVOLVER_ON.has(beat) && (
              <Revolver spinning={spinning} cocked={cocked} side={isExecute ? "left" : "self"} reduced={reduced} />
            )}

            {/* muzzle flash (LIVE, 80ms bright + fast decay — §4 law) */}
            {beat === "flash" && !reduced && (
              <motion.span
                className="absolute left-1/2 top-[62%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgb(255 245 214/1) 0%, rgb(232 165 75/0.85) 35%, rgb(217 87 74/0.4) 60%, transparent 75%)",
                }}
                initial={{ opacity: 1, scale: 0.4 }}
                animate={{ opacity: [1, 1, 0], scale: [0.4, 1.7, 1.9] }}
                transition={{ duration: 0.28, times: [0, 0.29, 1], ease: "linear" }}
                aria-hidden
              />
            )}

            {/* payoff stamps — always icon + text (colorblind-safe, STR/05 §7) */}
            <AnimatePresence>
              {(beat === "settle" || beat === "slump") && (
                <motion.div
                  key="stamp"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.3, 1], opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "backOut" }}
                  className={`flex flex-col items-center gap-1 rounded-btn border-4 px-6 py-3 ${
                    isLive ? "border-blood-bright bg-blood/20" : "border-verdict bg-verdict/15"
                  }`}
                >
                  <span className={`font-display text-2xl tracking-widest ${isLive ? "text-blood-bright" : "text-verdict"}`}>
                    {isLive ? "✖ ELIMINATED" : "✓ SURVIVED"}
                  </span>
                  <span className="font-body text-xs text-ivory">
                    {isLive
                      ? `${loserName} met the live round · ${shot.pulls}/6`
                      : `a dry click — ${loserName} lives · ${shot.pulls}/6`}
                  </span>
                  {!isLive && <span className="font-display text-lg text-lamp">PHEW.</span>}
                  {isLive && <span className="text-lg" aria-hidden>🕯</span>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* caption ladder (deaf players get every beat as text) */}
            <span className="h-4 font-body text-xs text-ink-dim">{beat ? (CAPTIONS[beat] ?? "") : ""}</span>
          </motion.div>

          {/* slam to black (LIVE) — snaps on (~60ms), lifts as the aftermath slumps in */}
          <AnimatePresence>
            {beat === "black" && (
              <motion.div
                key="slam-black"
                className="absolute inset-0 z-20 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.92 }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0.15 : 0.35, ease: "easeOut" } }}
                transition={{ duration: reduced ? 0.1 : 0.06, ease: "linear" }}
              />
            )}
          </AnimatePresence>

          {/* ghost-lounge handover for the hero */}
          {isLive && heroLoses && (beat === "slump" || beat === "black") && (
            <motion.span
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
              className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-brass-deep bg-wood-deep/95 px-4 py-1 font-body text-xs text-brass"
            >
              👻 the ghost lounge opens — emotes are yours while you spectate
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
