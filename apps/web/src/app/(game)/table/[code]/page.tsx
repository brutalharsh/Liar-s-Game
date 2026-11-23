import type { Metadata } from "next";
import { TableClient } from "@/components/table/TableClient";

export const metadata: Metadata = {
  title: "Table",
  description:
    "The felt itself: throw cards face-down, call liars, and pray the cylinder clicks empty in a live Liar's Game match.",
};

export default async function TablePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <div className="h-[100dvh] overflow-hidden">
      <TableClient code={code.toUpperCase()} />
    </div>
  );
}
