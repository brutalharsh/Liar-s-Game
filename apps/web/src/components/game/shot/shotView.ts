"use client";

import { useGameStore } from "@/store/game";

/** Display helpers shared by the shot cinematic + motion lab. */
export function nicknameOfStore(seat: number): string {
  const name = useGameStore.getState().nicknameOf(seat);
  return seat === useGameStore.getState().heroSeat ? "YOU" : name;
}
