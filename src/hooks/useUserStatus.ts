import { useState, useEffect } from "react";

export type UserStatus = "anonymous" | "free" | "pro";

export function useUserStatus(): UserStatus | null {
  const [status, setStatus] = useState<UserStatus | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await sb.auth.getUser();
        if (!user) {
          setStatus("anonymous");
          return;
        }
        // Fetch plan from profile
        const { data: profile } = await sb
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        setStatus(profile?.plan === "pro" ? "pro" : "free");
      } catch {
        setStatus("anonymous");
      }
    }
    check();
  }, []);

  return status;
}
