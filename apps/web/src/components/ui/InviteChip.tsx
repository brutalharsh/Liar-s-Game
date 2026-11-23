"use client";

import { useState } from "react";
import { useToasts } from "@/store/ui";
import { isValidRoomCode } from "@/lib/sanitize";
import { ROOM_CODE_CHARSET } from "@/lib/sanitize";

/** Room code chip with copy-to-clipboard (+ share where supported). */
export function InviteChip({ code, origin }: { code: string; origin: string }) {
  const push = useToasts();
  const [copied, setCopied] = useState(false);
  const link = `${origin}/r/${code}`;
  const valid = isValidRoomCode(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      push({ title: "Invite link copied", sub: link, tone: "good" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      push({ title: "Couldn't copy — long-press to copy", sub: link, tone: "bad" });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Liar's Game", text: `Pull up a chair — room ${code}`, url: link });
        return;
      } catch {
        /* user dismissed; fall through to copy */
      }
    }
    void copy();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={copy}
        title="Copy invite link"
        aria-label={`Room code ${code}, copy invite link`}
        className="flex items-center gap-2 rounded-btn border-2 border-dashed border-brass-deep bg-wood-deep px-4 py-2 font-display text-2xl tracking-[0.35em] text-brass hover:bg-wood"
      >
        {valid ? code : "—"}
        <span aria-hidden className="text-sm">
          {copied ? "✓" : "⧉"}
        </span>
      </button>
      <button
        onClick={share}
        aria-label="Share invite"
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-wood-mid bg-wood/70 text-xl hover:border-brass"
      >
        ⤴
      </button>
    </div>
  );
}

export { ROOM_CODE_CHARSET };
