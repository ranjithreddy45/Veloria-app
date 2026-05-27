import { isCapacitor } from "./platform";

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: string;
}

export interface StoredCredentials {
  username: string;
  password: string;
}

/**
 * Check whether biometric authentication is available on the device.
 * Returns { isAvailable: false, biometryType: "none" } on web.
 */
export async function isBiometricAvailable(): Promise<BiometricAvailability> {
  if (!isCapacitor()) {
    return { isAvailable: false, biometryType: "none" };
  }

  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );

    const result = await NativeBiometric.isAvailable();

    return {
      isAvailable: result.isAvailable,
      biometryType: biometryTypeToString(result.biometryType),
    };
  } catch (error) {
    console.error("[biometric] Failed to check availability:", error);
    return { isAvailable: false, biometryType: "none" };
  }
}

/**
 * Authenticate the user with biometric verification (Face ID, Touch ID, fingerprint).
 * Returns true if authentication succeeded, false otherwise.
 * Always returns false on web.
 */
export async function authenticateWithBiometric(
  reason?: string
): Promise<boolean> {
  if (!isCapacitor()) {
    console.info("[biometric] Biometric auth is not available on web.");
    return false;
  }

  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );

    await NativeBiometric.verifyIdentity({
      reason: reason ?? "Please authenticate to continue",
      title: "Biometric Authentication",
      subtitle: reason ?? "Verify your identity",
      description: "Use your biometric credentials to proceed",
    });

    // If verifyIdentity resolves without throwing, authentication succeeded
    return true;
  } catch (error) {
    console.error("[biometric] Authentication failed:", error);
    return false;
  }
}

/**
 * Store encrypted credentials in the device's secure storage using biometric protection.
 * No-op on web.
 */
export async function saveCredentials(
  server: string,
  username: string,
  password: string
): Promise<boolean> {
  if (!isCapacitor()) {
    console.info(
      "[biometric] Credential storage is not available on web."
    );
    return false;
  }

  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );

    await NativeBiometric.setCredentials({
      server,
      username,
      password,
    });

    return true;
  } catch (error) {
    console.error("[biometric] Failed to save credentials:", error);
    return false;
  }
}

/**
 * Retrieve stored credentials for the given server.
 * Returns { username, password } or null if not found / on web.
 */
export async function getCredentials(
  server: string
): Promise<StoredCredentials | null> {
  if (!isCapacitor()) {
    console.info(
      "[biometric] Credential retrieval is not available on web."
    );
    return null;
  }

  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );

    const credentials = await NativeBiometric.getCredentials({
      server,
    });

    return {
      username: credentials.username,
      password: credentials.password,
    };
  } catch (error) {
    console.error("[biometric] Failed to get credentials:", error);
    return null;
  }
}

/**
 * Delete stored credentials for the given server.
 * No-op on web.
 */
export async function deleteCredentials(server: string): Promise<boolean> {
  if (!isCapacitor()) {
    console.info(
      "[biometric] Credential deletion is not available on web."
    );
    return false;
  }

  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );

    await NativeBiometric.deleteCredentials({
      server,
    });

    return true;
  } catch (error) {
    console.error("[biometric] Failed to delete credentials:", error);
    return false;
  }
}

/**
 * Convert the numeric biometry type enum to a human-readable string.
 */
function biometryTypeToString(type: number): string {
  switch (type) {
    case 1:
      return "touchId";
    case 2:
      return "faceId";
    case 3:
      return "fingerprintAuthentication";
    case 4:
      return "faceAuthentication";
    case 5:
      return "irisAuthentication";
    default:
      return "none";
  }
}
