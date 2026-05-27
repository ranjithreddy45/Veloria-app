import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.veloriagrand.app",
  appName: "Veloria Grand",
  webDir: "out",
  server: {
    url: "https://app.theveloriagrand.com",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#09090b",
      showSpinner: true,
      spinnerColor: "#a855f7",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    scheme: "Veloria Grand",
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#09090b",
  },
};

export default config;
