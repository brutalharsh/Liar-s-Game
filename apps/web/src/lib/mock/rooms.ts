import type { AvatarSpec, LobbySnapshot, SeatView, ThemeId, Visibility } from "@/lib/wire";
import { generateRoomCode } from "@/lib/wire";
import { MOCK_PLAYERS } from "@/lib/mock/players";
import { themeMeta, DEFAULT_THEME } from "@/lib/mock/themes";
import { seededRng, randInt } from "@/lib/mock/rng";

/** Rough match-length heuristic for the lobby chip ("~8 min at 4 players"). */
export function estimateMatchMinutes(playerCount: number): number {
  if (playerCount <= 2) return 5;
  if (playerCount === 3) return 6;
  if (playerCount === 4) return 8;
  if (playerCount === 5) return 10;
  if (playerCount === 6) return 11;
  return 13;
}

function seat(seatNo: number, nickname: string | null, extra?: Partial<SeatView>): SeatView {
  return {
    seat: seatNo,
    nickname,
    avatar: null,
    isHost: false,
    connected: false,
    alive: true,
    pulled: 0,
    cardCount: null,
    locked: false,
    isBot: false,
    ...extra,
  };
}

const HERO_PLAYER = { base: "fox" } as const;

/** Builds a fresh demo lobby for any code (DEV ONLY — mirrors a server snapshot). */
export function makeDemoLobby(opts: {
  code: string;
  nickname: string;
  capacity?: number;
  theme?: ThemeId;
  visibility?: Visibility;
  name?: string;
}): LobbySnapshot {
  const capacity = Math.min(Math.max(opts.capacity ?? 7, 2), 7);
  const theme = (opts.theme ?? DEFAULT_THEME) as ThemeId;
  const seats: SeatView[] = [
    seat(0, opts.nickname || "YOU", {
      avatar: { ...HERO_PLAYER },
      isHost: true,
      connected: true,
    }),
    seat(1, "SCUBB", {
      avatar: { base: "raccoon", hat: "hat:cowboy" },
      connected: true,
      isBot: true,
    }),
  ];
  for (let i = 2; i < capacity; i++) seats.push(seat(i, null));
  return {
    code: opts.code,
    name: opts.name ?? `${opts.nickname || "YOUR"} TABLE`,
    theme,
    capacity,
    visibility: opts.visibility ?? "private",
    hostSeat: 0,
    seats,
    estMatchMinutes: estimateMatchMinutes(2),
    roomLocked: false,
  };
}

/** The public room browser list (mirrors GET /api/rooms). */
export interface PublicRoomCard {
  code: string;
  name: string;
  hostName: string;
  hostAvatar: AvatarSpec;
  theme: ThemeId;
  seats: number;
  capacity: number;
  locked: boolean;
  idleMinutes: number;
}

export function makePublicRooms(): PublicRoomCard[] {
  const rng = seededRng("public-rooms");
  const names = [
    "KING'S TABLE",
    "DIVE AFTER DARK",
    "GATOR ALLEY",
    "SALOON SHOWDOWN",
    "FOX'S DEN",
    "LAST ROUND",
    "MIDNIGHT HAND",
    "BULLET CLUB",
  ];
  const rooms: PublicRoomCard[] = [];
  const themeIds: ThemeId[] = ["saloon", "house", "neon", "royale", "speakeasy", "haunted", "orbital", "kabuki"];
  for (let i = 0; i < 8; i++) {
    const host = MOCK_PLAYERS[Math.floor(rng() * MOCK_PLAYERS.length)] ?? MOCK_PLAYERS[0];
    const seats = randInt(rng, 1, 6);
    rooms.push({
      // Codes the teach-page tells users to type: 5 chars from shared's
      // confusable-free alphabet (no I/L/O/0/1), minted by the SAME
      // generator the server uses — never chars a real code can't contain.
      code: generateRoomCode((max) => Math.floor(rng() * max)),
      name: names[i] ?? `TABLE ${i + 1}`,
      hostName: host.nickname,
      hostAvatar: { ...host.avatar },
      theme: themeIds[Math.floor(rng() * themeIds.length)] ?? "saloon",
      seats: Math.min(seats, 7),
      capacity: 7,
      locked: rng() < 0.25,
      idleMinutes: randInt(rng, 0, 9),
    });
  }
  return rooms;
}

export { themeMeta };
