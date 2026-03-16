"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm px-4 py-2 rounded-lg border border-card-border text-muted hover:text-foreground hover:bg-card transition-colors"
    >
      Sign Out
    </button>
  );
}
