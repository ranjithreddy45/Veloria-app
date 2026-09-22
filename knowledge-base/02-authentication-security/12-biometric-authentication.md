# CHUNK 02-12 — BIOMETRIC AUTHENTICATION

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/12-biometric-authentication.md`

---

## 📱 Native Mobile Biometric Shell (`src/lib/capacitor/biometric.ts`)

For mobile app users running on iOS or Android via Capacitor 8, native hardware biometric authentication (Touch ID, Face ID, Android Fingerprint/Face) is implemented via `@capgo/capacitor-native-biometric`.

```typescript
import { isCapacitor } from "./platform";

export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!isCapacitor()) return false;

  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    
    // 1. Verify hardware availability
    const available = await NativeBiometric.isAvailable();
    if (!available.isAvailable) return false;

    // 2. Trigger native OS biometric prompt
    await NativeBiometric.verifyIdentity({
      reason: "Authenticate to access Veloria Grand",
      title: "Biometric Login",
      subtitle: "Touch sensor or look at camera"
    });

    // 3. Retrieve stored credentials from iOS Keychain / Android KeyStore
    const credentials = await NativeBiometric.getCredentials({
      server: "app.veloriagrand.com"
    });

    return !!credentials.username;
  } catch (error) {
    console.error("[biometric] Auth failed:", error);
    return false;
  }
}
```
