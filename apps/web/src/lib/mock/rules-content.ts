/**
 * How-to-play content — distilled verbatim from STR/01 (the rules spec).
 * The rules engine owns the real logic (packages/rules-engine); this is
 * display copy only.
 */

export interface RuleSection {
  id: string;
  step: number;
  title: string;
  icon: string;
  body: string[];
  callout?: string;
}

export const RULE_SECTIONS: readonly RuleSection[] = [
  {
    id: "deal",
    step: 1,
    title: "The Deal",
    icon: "🃏",
    body: [
      "One deck of liar's cards: 6 Kings, 6 Queens, 6 Aces and 2 Jokers per 4 players (20 cards at 2–4p, 40 at 5–8p, 60 at 9–10p).",
      "Each round one Table Card is drawn — King, Queen or Ace. Every play this round claims to BE that rank.",
      "Every living player is dealt 5 cards. Each player also gets a revolver: 6 chambers, exactly 1 live round, its position fixed for the whole match at match start.",
    ],
    callout: "You will never know which chamber holds the live round. Nobody ever does.",
  },
  {
    id: "throw",
    step: 2,
    title: "The Throw",
    icon: "🤞",
    body: [
      "On your turn, secretly play 1–3 cards face-down onto the pile. Playing is an implicit claim: “all of these are the Table Card.”",
      "Lying is allowed — that's the game. Jokers are wild and always count as the Table Card, so they are always “truth”.",
      "You have 15–30 seconds (fewer players = more time). If the clock runs out, the table plays a staged or random card for you — you throw, never call, never shoot.",
    ],
  },
  {
    id: "call",
    step: 3,
    title: "Call Liar",
    icon: "🗣️",
    body: [
      "Challenge only the previous throw. It's illegal on the round's first play, and the dead can never call.",
      "2–4 players: only the next player after a throw may call (the authentic rule).",
      "5–10 players: after every throw there's an open 10-second window — any living player except the accused may CHECK. The window closes when the next player commits their own throw (a belief) or the timer expires.",
    ],
    callout: "Hold-1 rule: the instant only one player still holds cards, the game auto-calls LIAR on the last throw — unfalsifiable last plays win rounds.",
  },
  {
    id: "reveal",
    step: 4,
    title: "The Reveal",
    icon: "🔍",
    body: [
      "The accused's last play flips face-up, one card at a time.",
      "Any card that is neither the Table Card nor a Joker → the accused LIED.",
      "If every card is valid → the call fails and the accuser pays for it.",
    ],
  },
  {
    id: "shot",
    step: 5,
    title: "The Shot",
    icon: "🔫",
    body: [
      "The challenge loser faces the revolver. If a liar was caught, a fair 50/50 decides who pulls: the liar takes the gun themselves, or their accuser executes them. A false accuser always shoots themselves — no exceptions, no other target ever.",
      "The odds worsen every round: 1/6 → 1/5 → 1/4 → 1/3 → 1/2 → the 6th pull is certain death.",
      "BLANK: you survive, the round ends. LIVE: you're out — spectate from the ghost lounge with emotes only.",
    ],
    callout: "PG-13 guarantee: no gore, ever. A dramatic slump and a candle. That's all anyone sees.",
  },
  {
    id: "win",
    step: 6,
    title: "The Round After",
    icon: "🔄",
    body: [
      "Every roulette — blank or live — ends the round: fresh shuffle, fresh Table Card, 5 new cards each.",
      "Survivors earn +1 coin per round survived; the last player alive wins and takes 2–7 bonus coins.",
      "Last player breathing wins the match. XP flows for everyone: win 12 · survive 6 · die 4.",
    ],
  },
] as const;

export const DECK_TABLE: readonly { players: string; deck: string; note: string }[] = [
  { players: "2–4", deck: "20 cards", note: "one set (m=1)" },
  { players: "5–8", deck: "40 cards", note: "two sets (m=2)" },
  { players: "9–10", deck: "60 cards", note: "three sets (m=3)" },
] as const;

export const HOW_IT_WORKS: readonly { step: number; title: string; desc: string; icon: string }[] = [
  {
    step: 1,
    title: "Throw cards face-down",
    desc: "Claim they're all the Table Card — King, Queen or Ace. Lying is encouraged.",
    icon: "🃏",
  },
  {
    step: 2,
    title: "Call out the liar",
    desc: "The next player can cry LIAR any time — 5–10 player tables get a 10-second open window.",
    icon: "🗣️",
  },
  {
    step: 3,
    title: "The revolver decides",
    desc: "The loser of the call meets a 6-chamber revolver: 5 blanks, 1 live round. Play till one stands.",
    icon: "🔫",
  },
] as const;

/** Condensed rules strip for the lobby "rules drawer". */
export const QUICK_RULES: readonly string[] = [
  "Every play claims to be the Table Card (K/Q/A). Jokers are wild.",
  "1–3 cards per throw, face-down. Lying is the game.",
  "Only the previous throw can be challenged.",
  "Challenge loser faces the revolver: 1/6 odds, worse every round.",
  "Blank = survive. Live = ghost lounge.",
  "Last player alive wins.",
] as const;
