import type { ThemeId } from "@/lib/wire";

/**
 * Wire theme-slug ↔ UI theme-id adapter.
 *
 * The server validates free themes as the slugs 'saloon' and 'house-table'
 * (STR/02 v1, apps/server FREE_THEMES); the UI theme catalog (lib/mock/themes)
 * calls the second free card 'house'. The wire treats `theme` as an opaque
 * string (shared zod: z.string()), so we translate exactly at the two seams:
 * the create form (id → slug on the way out) and any server-fed display
 * (slug → id on the way in: room rows, lobby snapshot). Mock keep speaking
 * the id — both adapters leave unknown strings untouched.
 */

const WIRE_TO_ID: Record<string, ThemeId> = {
  "house-table": "house",
};

const ID_TO_WIRE: Partial<Record<ThemeId, string>> = {
  house: "house-table",
};

export function themeSlugFromId(id: ThemeId): string {
  return ID_TO_WIRE[id] ?? id;
}

export function themeIdFromSlug(slug: string): ThemeId {
  return WIRE_TO_ID[slug] ?? (slug as ThemeId);
}
