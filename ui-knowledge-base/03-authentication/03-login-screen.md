# LOGIN SCREEN FORENSICS (`/sign-in`)

## 1. Visual & Architectural Forensics

The primary sign-in screen is defined in [src/app/(auth)/sign-in/page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/page.tsx) and [src/app/(auth)/sign-in/_components/sign-in-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/_components/sign-in-form.tsx).

```
┌──────────────────────────────────────────────────────────┐
│                   VELORIA GRAND CREST                    │
│                     Welcome Back                         │
│       Sign in to access your Veloria Grand workspace     │
├──────────────────────────────────────────────────────────┤
│ Email Address                                            │
│ [ email@domain.com                                     ] │
│                                                          │
│ Password                            Forgot password?     │
│ [ ••••••••••••                                  👁️ ] │
│                                                          │
│ [                   Sign In  →                         ] │
├──────────────────────────────────────────────────────────┤
│ Don't have an account? Create an account                │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Component Hierarchy & Layout Breakdown

- **Outer Wrapper**: `(auth)/layout.tsx` - Centered background container (`min-h-screen bg-slate-950 flex items-center justify-center p-4`).
- **Card Container**: `rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl max-w-md w-full`.
- **Branding Header**:
  - Crest Icon: `flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20`.
  - Title: `text-2xl font-bold tracking-tight text-white`.
  - Subtitle: `text-sm text-slate-400`.
- **Form Component**: `<SignInForm />` (`src/app/(auth)/sign-in/_components/sign-in-form.tsx`).
- **Footer Link**: `<Link href="/sign-up">` navigation text.

---

## 3. UI State Behaviors

| UI State | Elements Involved | Visual / Behavioral Manifestation |
|---|---|---|
| **Default / Initial** | Input fields, Submit Button | Clean empty inputs, "Sign In" text on button, toggle password hidden |
| **Validation Error** | Label & Input borders | Red border (`border-red-500`), error text below input, toast notification |
| **Loading / Submitting** | Submit Button & Inputs | Button disabled, `Loader2` spin icon rendered, inputs disabled |
| **Error Returned** | Toast notification | `toast.error(result.error)` displayed via Sonner toast overlay |
| **2FA Pending** | Window location | Immediate redirect to `/two-factor` |
| **Success Redirect** | Window location | Immediate redirect to `/dashboard`, `/portal`, or `/vendor-portal` |
