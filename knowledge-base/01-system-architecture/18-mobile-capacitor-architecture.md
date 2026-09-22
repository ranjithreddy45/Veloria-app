# CHUNK 01-18 — CAPACITOR MOBILE ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/18-mobile-capacitor-architecture.md`

---

## 📱 Capacitor 8 Native Mobile Shell

The web application is packaged into native **iOS (`ios/`)** and **Android (`android/`)** apps using **Capacitor 8.1.0** (`capacitor.config.ts`).

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.veloriagrand.app",
  appName: "Veloria Grand",
  webDir: "out",
  server: {
    androidScheme: "https"
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
```

---

## 🔌 Integrated Native Plugins

- `@capgo/capacitor-native-biometric` (8.4.2): Native Face ID / Touch ID authentication for staff and clients.
- `@capacitor/camera` (8.0.1): Native device camera access for capturing expense receipts and venue maintenance photos.
- `@capacitor/push-notifications` (8.0.1): Hardware push notification registration.
- `@capacitor/haptics` (8.0.1): Tactile vibration feedback on button presses and form submissions.
