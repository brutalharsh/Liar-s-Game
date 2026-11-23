import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Your Liar's Game career: level and XP progress, wallet, equipped and unlocked titles, and your last ten matches.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
