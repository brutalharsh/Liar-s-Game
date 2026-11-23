"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { socket } from "@/lib/socket";
import { useToasts } from "@/store/ui";
import { parseCodeFromPasted, sanitizeRoomCode, ROOM_CODE_CHARSET } from "@/lib/sanitize";

/**
 * Join by 5-char code: tap-to-type boxes with auto-uppercase + auto-advance,
 * paste-box parses raw text OR invite links (/r/ABCDE).
 */
export function JoinView() {
  const router = useRouter();
  const push = useToasts();
  const [code, setCode] = useState("");
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus the hidden combiner input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const join = async (rawCode: string) => {
    const final = sanitizeRoomCode(rawCode);
    if (final.length !== 5) {
      push({ title: "Codes are 5 characters", sub: "A–Z and 2–9, no I/L/O/0/1.", tone: "bad" });
      return;
    }
    setPending(true);
    const res = await socket.emit({ type: "room:join", code: final });
    if (!res.ok) {
      setPending(false);
      push({ title: res.errorMessage ?? "Couldn't join that room", tone: "bad" });
      return;
    }
    // mock accepts any well-formed code; navigate to its lobby
    router.push(`/lobby/${final}`);
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
            onKeyDown={(e) => {
              if (e.key === "Enter") void join(code);
            }}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
            className="absolute inset-0 h-full w-full cursor-pointer bg-transparent text-center text-transparent caret-transparent opacity-0"
          />
          <div className="pointer-events-none flex justify-center gap-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => {
              const ch = code[i] ?? "";
              return (
                <span
                  key={i}
                  className={`flex h-16 w-12 items-center justify-center rounded-btn border-2 font-display text-3xl md:h-20 md:w-14 ${
                    ch
                      ? "border-brass bg-wood-deep text-brass"
                      : "border-wood-mid bg-wood-deep/60 text-ink-dim"
                  } ${code.length === i ? "border-lamp" : ""}`}
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

        <p className="mt-3 text-center font-body text-[11px] text-ink-dim">
          charset: <strong className="text-lamp">{ROOM_CODE_CHARSET.split("").slice(0, 12).join("")}…</strong> (25
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
            className="min-h-12 flex-1 rounded-btn border-2 border-wood-mid bg-wood-deep px-3 font-body text-sm text-ivory placeholder:text-ink-dim/40 focus:border-brass"
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
