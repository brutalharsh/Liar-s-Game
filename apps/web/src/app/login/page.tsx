import type { Metadata } from "next";
import { LoginView } from "@/components/auth/LoginView";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with Discord or Google to create, join or play Liar's Game.",
};

export default function LoginPage() {
  return (
    <div className="min-h-dvh px-safe pb-safe pt-safe">
      <LoginView />
    </div>
  );
}
