import { redirect } from "next/navigation";

/**
 * /r/[code] — invite links (STR/02): the share URL IS the seat key.
 * Straight hop to the lobby.
 */
export default async function InviteRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/lobby/${code.toUpperCase()}`);
}
