import { useEffect, useRef } from "react";

export function usePushNotifications(isLoggedIn: boolean) {
  const registered = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || registered.current) return;
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
          // Send token to our API
          await fetch("/api/notifications/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token.value, platform: "android" }),
          });
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
