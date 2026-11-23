"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { joinErrorCopy, joinRoomByCode } from "@/components/join/join-flow";
import { useToasts } from "@/store/ui";
import { parseCodeFromPasted, sanitizeRoomCode, ROOM_CODE_CHARSET } from "@/lib/sanitize";

/**
 * Join by 5-char code: tap-to-type boxes with auto-uppercase + auto-advance,
 * paste-box parses raw text OR invite links (/r/ABCDE). /join?code=PREFI
 * prefills the boxes (invite links land here). Live acks route by snapshot
 * phase: lobby-phase → lobby, mid-match rejoin → table (reconnected seat).
 */
export function JoinView() {
  const router = useRouter();
  const push = useToasts();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState<{ title: string; sub?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus the hidden combiner input on mount; ?code= prefills the row
  useEffect(() => {
    const prefill = searchParams.get("code");
    if (prefill) setCode(sanitizeRoomCode(prefill));
    inputRef.current?.focus();
  }, [searchParams]);

  const join = async (rawCode: string) => {
    const final = sanitizeRoomCode(rawCode);
    if (final.length !== 5) {
      push({ title: "Codes are 5 characters", sub: "A–Z and 2–9, no I/L/O/0/1.", tone: "bad" });
      return;
    }
    setPending(true);
    setFailed(null);
    const outcome = await joinRoomByCode(final);
    setPending(false);
    if (!outcome.ok) {
      const copy = joinErrorCopy(outcome.errorCode);
      setFailed(copy);
      push({ title: copy.title, sub: outcome.errorMessage, tone: "bad" });
      return;
    }
    if (outcome.spectator) {
      push({ title: "That table's packed — spectating", sub: "You'll get a seat the moment one opens.", tone: "info" });
    } else if (outcome.destination === "table") {
      push({ title: "Welcome back — your seat's still warm", tone: "good" });
    }
    router.push(`/${outcome.destination}/${final}`);
  };

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Join with code</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Someone slack about their code? Codes skip look-alikes: no I, L, O, 0 or 1.
        </p>
      </section>

      <Panel className="w-full max-w-md p-6">
        {/* tap row of 5 boxes driven by one input */}
        <div className="relative">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(sanitizeRoomCode(e.target.value).slice(0, 5))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void join(code);
            }}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
            className="absolute inset-0 h-full w-full cursor-pointer bg-transparent text-center text-transparent caret-transparent opacity-0"
          />
          <div className="pointer-events-none flex justify-center gap-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => {
              const ch = code[i] ?? "";
              // The lamp border marks the box the caret sits in — but only
              // while the (invisible) input is focused, so it doubles as a
              // real focus indicator: opacity-0 hides the input's own outline.
              const active = focused && code.length === i;
              return (
                <span
                  key={i}
                  className={`flex h-16 w-12 items-center justify-center rounded-btn border-2 font-display text-3xl md:h-20 md:w-14 ${
                    ch
                      ? "border-brass bg-wood-deep text-brass"
                      : "border-wood-mid bg-wood-deep/60 text-ink-dim"
                  } ${active ? "border-lamp shadow-spotlight" : ""}`}
                >
                  {ch || "·"}
                </span>
              );
            })}
          </div>
        </div>

        <Button
          variant="brass"
          size="big"
          className="mt-6 w-full text-xl"
          disabled={code.length !== 5 || pending}
          onClick={() => void join(code)}
        >
          {pending ? "PULLING UP A CHAIR…" : "JOIN TABLE"}
        </Button>

        {/* code-level failure — friendly, with retry + rooms CTAs */}
        {failed && (
          <div role="alert" className="mt-4 flex flex-col items-center gap-2 rounded-card border-2 border-blood/70 bg-wood/70 px-4 py-3 text-center">
            <p className="font-display text-base text-ivory">{failed.title}</p>
            {failed.sub && <p className="font-body text-xs text-ink-dim">{failed.sub}</p>}
            <div className="mt-1 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void join(code)}>
                RETRY
              </Button>
              <a
                href="/rooms"
                className="flex min-h-12 items-center rounded-btn border-2 border-brass bg-brass px-4 font-display text-sm text-wood-deep"
              >
                BROWSE ROOMS
              </a>
            </div>
          </div>
        )}

        <p className="mt-3 text-center font-body text-[11px] text-ink-dim">
          charset: <strong className="text-lamp">{ROOM_CODE_CHARSET.split("").slice(0, 12).join("")}…</strong> (31
          letters/digits)
        </p>
      </Panel>

      {/* paste an invite link */}
      <Panel tone="deep" className="w-full max-w-md p-6">
        <label htmlFor="paste" className="font-body text-xs uppercase tracking-widest text-lamp">
          Paste invite link instead
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="https://liars.game/r/DUMMY"
            className="min-h-12 flex-1 rounded-btn border-2 border-wood-mid bg-wood-deep px-3 font-body text-sm text-ivory placeholder:text-ink-dim/70 focus:border-brass"
          />
          <Button
            variant="outline"
            onClick={() => {
              const parsed = parseCodeFromPasted(pasted);
              if (!parsed) {
                push({ title: "No 5-char code found in that", tone: "bad" });
                return;
              }
              setCode(parsed);
              void join(parsed);
            }}
          >
            PARSE & JOIN
          </Button>
        </div>
        <p className="mt-2 font-body text-[11px] text-ink-dim">
          Full links, bare codes, or a messy Discord paste — we dig the code out either way.
        </p>
      </Panel>

      <p className="font-body text-sm text-ink-dim">
        No code?{" "}
        <a href="/rooms" className="text-brass underline">
          Browse public rooms
        </a>
      </p>
    </div>
  );
}
