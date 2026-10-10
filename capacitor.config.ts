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
    // Barres systeme transparentes par-dessus la page ; icones claires (theme sombre).
    // Le site reserve la place avec env(safe-area-inset-*) (viewport-fit=cover).
    StatusBar: {
      style: "DARK",
      overlaysWebView: true,
    },
    // Plugin du coeur de Capacitor 8 : style des deux barres (etat et navigation) et
    // gestion des marges sur Android 15+ (bord a bord impose).
    SystemBars: {
      style: "DARK",
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
