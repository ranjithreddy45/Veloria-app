# PASSWORD UI FORENSICS & SPECIFICATIONS

## 1. Password Management Surfaces

Password interactions occur across 4 UI surfaces:

1. **Sign-In Form (`/sign-in`)**: Password input with visibility toggle.
2. **Sign-Up Form (`/sign-up`)**: Password + Confirm Password fields with validation rules.
3. **Reset Password Form (`/reset-password`)**: Token-based new password setup.
4. **Security Settings (`/me/security`)**: Self-service current password verification + new password update.

---

## 2. Password Strength & Validation Rules (`signUpSchema`)

In [auth.schema.ts](file:///Users/fci/Documents/Veloria-app/src/schemas/auth.schema.ts), password creation adheres to strict complexity constraints:

```typescript
export const signUpSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
```

---

## 3. Password Visibility Toggle Component

- **Icon**: `Eye` (Show) / `EyeOff` (Hide) from `lucide-react`.
- **Implementation Pattern**:
```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
  aria-label={showPassword ? "Hide password" : "Show password"}
>
  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
</button>
```
