import type { Metadata } from "next";
import { RoomsView } from "@/components/rooms/RoomsView";

export const metadata: Metadata = {
  title: "Public rooms",
};

export default function RoomsPage() {
  return <RoomsView />;
}
