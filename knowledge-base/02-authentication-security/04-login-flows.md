# CHUNK 02-04 — LOGIN FLOWS

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/04-login-flows.md`

---

## 🚪 Verified Authentication Sequences

### Flow 1: Staff Credentials Login + 2FA Challenge

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Staff User
    participant Form as /sign-in (RCC)
    participant AuthTS as auth.ts (Credentials Provider)
    participant DB as PostgreSQL (Prisma ORM)
    participant TOTP as 2FA Verifier (src/lib/security)
    participant Middleware as middleware.ts

    Staff->>Form: Enters Email & Password
    Form->>AuthTS: signIn("credentials", { email, password })
    AuthTS->>DB: prisma.user.findUnique({ where: { email } })
    DB-->>AuthTS: User Record (passwordHash, twoFactorEnabled)
    AuthTS->>AuthTS: bcryptjs.compare(password, user.passwordHash)
    AuthTS->>AuthTS: Check user.twoFactorEnabled
    alt 2FA Enabled
        AuthTS-->>Form: Throws TwoFactorRequiredError
        Form->>Staff: Redirects to /two-factor Challenge Screen
        Staff->>Form: Enters 6-digit TOTP / Recovery Code
        Form->>TOTP: verifySecondFactor(userId, code)
        TOTP->>DB: Validate TOTP Secret & Decrypt
        TOTP-->>AuthTS: 2FA Verified OK
    end
    AuthTS-->>Form: Returns Valid Session JWT
    Form->>Middleware: Redirects to /dashboard
    Middleware-->>Staff: Renders Executive Dashboard
```

---

## 📱 Mobile Biometric Native Authentication Flow (`src/lib/capacitor/biometric.ts`)

```mermaid
sequenceDiagram
    autonumber
    actor MobileUser as Mobile App User
    participant App as Capacitor Mobile Shell
    participant BioPlugin as @capgo/capacitor-native-biometric
    participant KeyStore as iOS Keychain / Android KeyStore
    participant AuthTS as auth.ts Server Endpoint

    MobileUser->>App: Opens App & Taps "Biometric Sign-In"
    App->>BioPlugin: NativeBiometric.isAvailable()
    BioPlugin-->>App: { isAvailable: true, biometryType: "TOUCH_ID" / "FACE_ID" }
    App->>BioPlugin: NativeBiometric.verifyIdentity({ reason: "Access Veloria Grand" })
    BioPlugin->>MobileUser: Displays Native OS Face ID / Fingerprint Prompt
    MobileUser->>BioPlugin: Scans Biometrics
    BioPlugin-->>App: Hardware Authentication Success
    App->>KeyStore: NativeBiometric.getCredentials({ server: "app.veloriagrand.com" })
    KeyStore-->>App: Returns Stored Encrypted Credentials (Username/Token)
    App->>AuthTS: Autologin with Secure Stored Credentials
    AuthTS-->>App: Returns Session Token -> Access Granted
```
