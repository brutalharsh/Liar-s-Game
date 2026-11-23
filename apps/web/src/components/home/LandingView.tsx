"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { AsyncSection, EmptyState, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { mockFetch } from "@/lib/mock/api";
import { makePublicRooms, type PublicRoomCard } from "@/lib/mock/rooms";
import { themeMeta } from "@/lib/mock/themes";
import { HOW_IT_WORKS } from "@/lib/mock/rules-content";
import { RULE_ICON, LockIcon, RoomsIcon, ShotIcon } from "@/components/ui/icons";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

function LiveRoomsStrip() {
  const query = useMockQuery<PublicRoomCard[]>(() => mockFetch(makePublicRooms()), []);
  return (
    <AsyncSection
      query={query}
      skeleton={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      }
      isEmpty={(data) => data.length === 0}
      empty={
        <EmptyState
          icon={<RoomsIcon size={28} />}
          title="No public tables right now"
          sub="Be the one who opens the first room tonight."
        />
      }
    >
      {(rooms) => (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.slice(0, 3).map((room) => (
            <Link
              key={room.code}
              href="/rooms"
              className="group rounded-card border-2 border-wood-mid/60 bg-wood/60 p-4 transition-colors hover:border-brass"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg text-ivory group-hover:text-brass">{room.name}</span>
                {room.locked && <LockIcon size={14} label="locked" className="text-ink-dim" />}
              </div>
              <div className="mt-1 font-body text-xs text-ink-dim">
                {room.hostName} hosting · {themeMeta(room.theme).name}
              </div>
              <div className="mt-2 flex items-center gap-1" aria-label={`${room.seats} of ${room.capacity} seats taken`}>
                {Array.from({ length: room.capacity }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${i < room.seats ? "bg-brass" : "bg-wood-mid"}`}
                  />
                ))}
                <span className="ml-2 font-body text-xs text-ink-dim">
                  {room.seats}/{room.capacity}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AsyncSection>
  );
}

export function LandingView() {
  const reduced = usePrefersReducedMotion();
  // Rise-only entrance: content paints with SSR (no opacity-0 before
  // hydration — keeps mobile LCP at font-load time, not JS hydration), then
  // drifts up on a transform (no CLS either way).
  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { y: 24 },
          animate: { y: 0 },
          transition: { delay, duration: 0.7 },
        };

  return (
    <div className="flex flex-col gap-16 py-8">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-card px-4 py-16 text-center md:py-24">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, color-mix(in srgb, var(--color-lamp) 14%, transparent), transparent 70%)",
          }}
        />
        <motion.p {...rise(0)} className="font-body text-xs uppercase tracking-[0.3em] text-lamp">
          2–7 players · free · invite-link instant play
        </motion.p>
        <motion.h1
          {...rise(0.15)}
          className="mt-3 font-display text-6xl text-ivory md:text-8xl"
          style={{ textShadow: "0 6px 30px color-mix(in srgb, var(--color-wood-deep) 60%, transparent)" }}
        >
          LIAR'S GAME
        </motion.h1>
        <motion.p {...rise(0.3)} className="mx-auto mt-4 max-w-xl font-body text-base text-ink-dim md:text-lg">
          Throw cards. Call the bluff. Mind the revolver. Five empty chambers between you and
          the door — the saloon's always full of smooth talkers.
        </motion.p>
        <motion.div {...rise(0.45)} className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/create"
            className="inline-flex min-h-16 touch-manipulation items-center justify-center gap-2 rounded-btn border-2 border-brass-deep bg-gradient-to-b from-brass to-lamp px-6 font-display text-xl tracking-wide text-wood-deep hover:brightness-110 active:brightness-95"
          >
            CREATE A TABLE
          </Link>
          <Link
            href="/join"
            className="inline-flex min-h-16 touch-manipulation items-center justify-center gap-2 rounded-btn border-2 border-ink-dim/70 bg-transparent px-8 font-display text-xl tracking-wide text-ivory hover:border-brass hover:text-brass"
          >
            JOIN WITH CODE
          </Link>
        </motion.div>
        <motion.div {...rise(0.6)} className="mt-6 flex flex-wrap justify-center gap-x-3 font-body text-xs text-ink-dim">
          <Link href="/rooms" className="inline-flex min-h-12 items-center px-2 underline hover:text-ivory">
            public rooms
          </Link>
          <Link href="/leaderboard" className="inline-flex min-h-12 items-center px-2 underline hover:text-ivory">
            leaderboard
          </Link>
          <Link href="/shop" className="inline-flex min-h-12 items-center px-2 underline hover:text-ivory">
            shop
          </Link>
          <Link href="/how-to-play" className="inline-flex min-h-12 items-center px-2 underline hover:text-ivory">
            how to play
          </Link>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <SectionTitle kicker="the con">How the table works</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => {
            const Glyph = RULE_ICON[step.icon];
            return (
              <motion.div key={step.step} {...rise(0.2 + i * 0.15)} className="h-full">
                <Panel className="h-full p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brass-deep bg-wood-deep font-display text-lg text-brass">
                      {step.step}
                    </span>
                    <span className="text-lamp" aria-hidden>
                      <Glyph size={30} />
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl text-ivory">{step.title}</h3>
                  <p className="mt-1 font-body text-sm text-ink-dim">{step.desc}</p>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* LIVE ROOMS */}
      <section>
        <SectionTitle kicker="tonight">Tables already dealing</SectionTitle>
        <LiveRoomsStrip />
        <div className="mt-4 text-center">
          <Link href="/rooms" className="inline-flex min-h-12 items-center font-body text-sm text-red-text underline">
            Browse all public rooms →
          </Link>
        </div>
      </section>

      {/* TABLE FELT TEASER */}
      <section>
        <Panel className="overflow-hidden p-6 md:p-10">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <span className="shrink-0 text-blood-bright" aria-hidden>
              <ShotIcon size={64} className="size-16 md:size-24" />
            </span>
            <div>
              <SectionTitle kicker="the stakes">One revolver, six chambers</SectionTitle>
              <p className="font-body text-sm leading-relaxed text-ink-dim">
                Every wrong call feeds the cylinder. The odds climb each round — 1-in-6, then 1-in-5,
                until pull six is certain. Survive the click and the table exhales; hear the bang and
                you're spectating from the ghost lounge. Cosmetic coins and titles only — no
                real-money anything, ever.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["5 cards a hand", "3-by-3 second windows", "jokers wild", "PG-13 slumps"].map((chip) => (
                  <span key={chip} className="rounded-full border border-lamp/50 bg-lamp/10 px-3 py-1 font-body text-xs text-lamp">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
