/**
 * Avatar engine barrel (apps/web/src/components/avatar) — the layered SVG
 * paper-doll that renders a wire `AvatarSpec` "same to same": base body →
 * shirt → beard → hair → hat → glasses → frame (STR/03 §2 stack order).
 */
export { Avatar, resolveBodyPlan } from "./Avatar";
export { AvatarThumb } from "./AvatarThumb";
export type { PartSlot } from "./parts/wearables";
export { AVATAR_PALETTE, BASE_GEOMETRY, NEUTRAL_GEOMETRY, PART_ADJUST, type BodyGeometry } from "./layout";
