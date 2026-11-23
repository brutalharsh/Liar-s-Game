"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { socket } from "@/lib/socket";
import { useIdentityStore } from "@/store/identity";
import { useToasts } from "@/store/ui";
import { sanitizeNickname } from "@/lib/sanitize";
import { THEMES } from "@/lib/mock/themes";
import { ANIMALS } from "@/lib/mock/avatar";
import type { ThemeId, Visibility } from "@/lib/wire";

const CAPACITIES = [2, 3, 4, 5, 6, 7] as const;

export function CreateView() {
  const router = useRouter();
  const push = useToasts();
  const nickname = useIdentityStore((s) => s.nickname);
  const avatar = useIdentityStore((s) => s.avatar);
  const setNickname = useIdentityStore((s) => s.setNickname);
  const setAvatar = useIdentityStore((s) => s.setAvatar);

  const [draft, setDraft] = useState(nickname);
  const [capacity, setCapacity] = useState<number>(7);
  const [theme, setTheme] = useState<ThemeId>("saloon");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [pending, setPending] = useState(false);

  const sanitized = sanitizeNickname(draft);

  const create = async () => {
    if (sanitized.error) {
      push({ title: sanitized.error, tone: "bad" });
      return;
    }
    setNickname(sanitized.value);
    setPending(true);
    const res = await socket.emit({
      type: "room:create",
      name: `${sanitized.value}'S TABLE`,
      capacity,
      theme,
      visibility,
    });
    setPending(false);
    if (!res.ok || !res.code) {
      push({ title: res.errorMessage ?? "Couldn't open the table", tone: "bad" });
      return;
    }
    push({ title: `Table ${res.code} is open`, sub: "Invite links, please.", tone: "good" });
    router.push(`/lobby/${res.code}`);
  };

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Open a table</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">You're the host — house rules are yours.</p>
      </section>

      <div className="mx-auto w-full max-w-3xl">
        <Panel className="flex flex-col gap-6 p-5 md:p-7">
          {/* nickname + avatar */}
          <section>
            <SectionTitle kicker="who's bluffing">Your face at the table</SectionTitle>
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex flex-col items-center gap-3">
                <Avatar spec={avatar} size="xl" />
                <button
                  onClick={() => {
                    const next = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]?.id;
                    if (next) setAvatar({ ...avatar, animal: next });
                  }}
                  className="font-body text-xs text-brass underline"
                >
                  shuffle starter animal
                </button>
                <span className="font-body text-[10px] text-ink-dim">
                  more hair, hats & frames in the{" "}
                  <a href="/shop" className="underline text-brass">
                    shop
                  </a>
                </span>
              </div>
              <div className="flex-1">
                <label htmlFor="nickname" className="font-body text-xs uppercase tracking-widest text-lamp">
                  Nickname
                </label>
                <input
                  id="nickname"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => setDraft(sanitizeNickname(draft).value || draft)}
                  placeholder="SHELF-MINDED SAM"
                  maxLength={12}
                  autoComplete="off"
                  className="mt-1 w-full rounded-btn border-2 border-wood-mid bg-wood-deep px-4 py-3 font-display text-xl tracking-wide text-ivory placeholder:text-ink-dim/40 focus:border-brass"
                />
                <p className="mt-1 font-body text-[11px] text-ink-dim">
                  2–12 characters. Sanitized live — control characters get brushed off.{" "}
                  {sanitized.error && <strong className="text-blood-bright">{sanitized.error}</strong>}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ANIMALS.map((animal) => (
                    <button
                      key={animal.id}
                      onClick={() => setAvatar({ ...avatar, animal: animal.id })}
                      aria-label={animal.label}
                      aria-pressed={avatar.animal === animal.id}
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl ${
                        avatar.animal === animal.id ? "border-brass bg-brass/15" : "border-wood-mid bg-wood-deep hover:border-brass"
                      }`}
                    >
                      {animal.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* capacity */}
          <section>
            <SectionTitle kicker="seats">Table capacity</SectionTitle>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Capacity">
              {CAPACITIES.map((cap) => (
                <button
                  key={cap}
                  role="radio"
                  aria-checked={capacity === cap}
                  onClick={() => setCapacity(cap)}
                  className={`flex h-14 w-14 items-center justify-center rounded-btn border-2 font-display text-lg ${
                    capacity === cap ? "border-brass bg-brass/15 text-brass" : "border-wood-mid bg-wood-deep text-ink-dim hover:border-brass"
                  }`}
                >
                  {cap}
                </button>
              ))}
            </div>
            <p className="mt-2 font-body text-[11px] text-ink-dim">
              Free tables seat 2–7. Big Table 8–10 arrives with a premium host pass (v1.x).
            </p>
          </section>

          {/* theme */}
          <section>
            <SectionTitle kicker="dress code">Table theme</SectionTitle>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {THEMES.map((t) => {
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (!t.free) {
                        push({ title: `${t.name} is premium`, sub: `🪙 ${t.price} in the shop`, tone: "info" });
                        return;
                      }
                      setTheme(t.id);
                    }}
                    aria-pressed={selected}
                    className={`relative flex min-h-24 flex-col items-start gap-1 rounded-card border-2 p-3 text-left ${
                      selected
                        ? "border-brass bg-brass/10"
                        : t.free
                          ? "border-wood-mid bg-wood/60 hover:border-brass"
                          : "border-wood-mid/40 bg-wood-deep/50"
                    }`}
                  >
                    <span className="font-display text-base text-ivory">{t.name}</span>
                    <span className="font-body text-[10px] text-ink-dim">{t.free ? "FREE" : `🪙 ${t.price}`}</span>
                    <span
                      aria-hidden
                      className="mt-2 h-6 w-full rounded-btn border border-wood-mid"
                      style={{ background: `linear-gradient(135deg, ${t.swatch.felt}, ${t.swatch.wood})` }}
                    />
                    {!t.free && (
                      <span className="absolute right-2 top-2 text-sm" aria-label="locked">
                        🔒
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* visibility */}
          <section>
            <SectionTitle kicker="door policy">Visibility</SectionTitle>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Visibility">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={visibility === v}
                  onClick={() => setVisibility(v)}
                  className={`flex min-h-12 items-center gap-2 rounded-btn border-2 px-4 font-display text-sm ${
                    visibility === v ? "border-brass bg-brass/15 text-brass" : "border-wood-mid bg-wood-deep text-ink-dim hover:border-brass"
                  }`}
                >
                  {v === "private" ? "🔒 PRIVATE — invite only" : "🌎 PUBLIC — listed in the room browser"}
                </button>
              ))}
            </div>
          </section>

          <Button variant="brass" size="big" className="text-xl" disabled={pending || !!sanitized.error} onClick={() => void create()}>
            {pending ? "OPENING…" : "DEAL THE FIRST HAND"}
          </Button>
          <p className="text-center font-body text-[11px] text-ink-dim">
            Opens lobby <strong className="text-brass">DUMMY</strong> in this build (mock server —
            the real room service lands with wave S1).
          </p>
        </Panel>
      </div>
    </div>
  );
}
