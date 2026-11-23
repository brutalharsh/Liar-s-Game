import type { Metadata } from "next";
import { CreateView } from "@/components/create/CreateView";

export const metadata: Metadata = {
  title: "Create a table",
};

export default function CreatePage() {
  return <CreateView />;
}
