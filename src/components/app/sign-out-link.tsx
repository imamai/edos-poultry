"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Sign out"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="text-ink-soft hover:text-danger"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
