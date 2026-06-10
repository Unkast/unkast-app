import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.unkast.app",
  appName: "Unkast",
  webDir: "public",
  server: {
    url: "http://192.168.1.241:3000",
    cleartext: true,
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
