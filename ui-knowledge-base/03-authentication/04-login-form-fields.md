# LOGIN FORM FIELDS FORENSICS

## 1. Field Inventory

The Sign-In form ([sign-in-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/_components/sign-in-form.tsx)) contains 2 interactive fields and 1 action control.

---

### AUTH-FIELD-0001: Email Field
- **Field Name**: `email`
- **Label**: `Email address`
- **HTML Element**: `<Input id="email" type="email" />`
- **Autocomplete**: `email`
- **Input Mode**: `email`
- **Placeholder**: `name@company.com` or `alex@example.com`
- **Required**: Yes (`min(1, "Email is required")`)
- **Client Validation**: Zod `signInSchema` checking string email format (`.email("Enter your full email address...")`)
- **Default Value**: `""` (Empty string)
- **Error State**: Displays red border and validation error message.

---

### AUTH-FIELD-0002: Password Field
- **Field Name**: `password`
- **Label**: `Password`
- **HTML Element**: `<Input id="password" type={showPassword ? "text" : "password"} />`
- **Autocomplete**: `current-password`
- **Placeholder**: `••••••••`
- **Required**: Yes (`min(1, "Password is required")`)
- **Client Validation**: Zod `signInSchema` (`min(6, "Password must be at least 6 characters")`)
- **Visibility Toggle**: Interactive button with `Eye` / `EyeOff` icons (`lucide-react`) positioned absolutely at `right-3 top-1/2 -translate-y-1/2`.
- **Default Value**: `""`
- **Error State**: Displays red border and validation error message.

---

### AUTH-FIELD-0003: Forgot Password Link
- **Field Target**: `/forgot-password`
- **Positioning**: Top-right above the password input field.
- **Styling**: `text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors`.
- **Behavior**: Standard client-side routing via Next.js `<Link>`.

---

### AUTH-FIELD-0004: Submit Action Button
- **Label**: `Sign In` (Default) / `Signing in…` (Submitting)
- **Type**: `submit`
- **Styling**: `w-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold hover:from-amber-400 hover:to-amber-500 transition-all`
- **Disabled State**: Disabled during `isPending` state (`startTransition`).
- **Icon**: `Loader2` (Animated spinner when pending) or `ArrowRight`.

---

## 2. Remember Me Feature Forensic Check

- **Forensic Finding**: `NOT FOUND IN FORM`
- **Explanation**: The Veloria Grand sign-in UI does NOT include a "Remember Me" checkbox component. NextAuth session duration is governed globally by the JWT session cookie maxAge configuration in `auth.ts` (30 days default).
