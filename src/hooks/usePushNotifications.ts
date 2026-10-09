import { useEffect, useRef } from "react";

// Jeton de l'appareil, garde pour le detacher du compte a la deconnexion (AppShell)
// et le rattacher au compte suivant sans redemander l'enregistrement.
export const PUSH_TOKEN_KEY = "unkast_push_token";

function sendToken(token: string) {
  return fetch("/api/notifications/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "android" }),
  });
}

export function usePushNotifications(isLoggedIn: boolean) {
  const registered = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (registered.current) {
      // Reconnexion sans rechargement : le jeton a ete detache a la deconnexion.
      try {
        const token = localStorage.getItem(PUSH_TOKEN_KEY);
        if (token) sendToken(token).catch(() => {});
      } catch {}
      return;
    }
    // Only run on native (Capacitor)
    if (typeof window === "undefined") return;

    async function setup() {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") return;

        // Register with FCM
        await PushNotifications.register();

        // Listen for token
        PushNotifications.addListener("registration", async (token) => {
          registered.current = true;
          try {
            localStorage.setItem(PUSH_TOKEN_KEY, token.value);
          } catch {}
          // Send token to our API
          await sendToken(token.value);
        });

        // Handle registration error
        PushNotifications.addListener("registrationError", (error) => {
          console.warn("Push registration error:", error);
        });

        // Handle notification received while app is open
        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push received:", notification);
        });

        // Handle notification tap (app was in background)
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = action.notification.data;
          if (data?.url) {
            window.location.href = data.url;
          }
        });
      } catch {
        // Not running in Capacitor (web browser) — silently ignore
      }
    }

    setup();
  }, [isLoggedIn]);
}
