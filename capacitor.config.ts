import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.unkast.app",
  appName: "Unkast",
  webDir: "public",
  server: {
    url: "https://app.unkast.com",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d0d0d",
    },
  },
};

export default config;
