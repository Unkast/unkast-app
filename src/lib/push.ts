import admin from "@/lib/firebase-admin";
import { createAdminClient } from "@/lib/supabase/admin";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Send push notification to all devices of a user
export async function sendPushToUser(profileId: string, payload: PushPayload) {
  const supabase = createAdminClient();

  // Get all tokens for this user
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("profile_id", profileId);

  if (!tokens || tokens.length === 0) return;

  const messaging = admin.messaging();

  // Send to each device
  const results = await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({
        token: t.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          url: payload.url || "/dashboard",
        },
        android: {
          priority: "high" as const,
          notification: {
            channelId: "unkast_default",
            color: "#C8FF00",
          },
        },
      })
    )
  );

  // Clean up invalid tokens
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const error = result.reason;
      if (
        error?.code === "messaging/registration-token-not-registered" ||
        error?.code === "messaging/invalid-registration-token"
      ) {
        await supabase
          .from("push_tokens")
          .delete()
          .eq("token", tokens[i].token);
      }
    }
  }
}
