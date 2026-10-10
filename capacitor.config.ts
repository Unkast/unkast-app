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
    // Connexion Google native (lot 11). Seul Google est embarque : les SDK des
    // autres fournisseurs du plugin ne sont pas inclus dans l'APK.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d0d0d",
    },
  },
};

export default config;
