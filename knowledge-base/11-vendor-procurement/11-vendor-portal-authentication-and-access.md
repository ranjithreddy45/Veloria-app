# 11 - Vendor Portal Authentication & Access

---

## 🔐 Auth & Identity Model

- **Authentication System**: Leverages NextAuth v5 session cookies.
- **User Role**: Dedicated `VENDOR` enum value in `User.role`.
- **Portal Invitation Flow**:
  1. Operations staff invoke `generateVendorPortalInvite(vendorId)`.
  2. Creates a tokenized activation URL: `/vendor-activate?vendor=ID&token=TOKEN`.
  3. Vendor visits activation link logged out, sets password (`acceptVendorInvite()`).
  4. System creates a `User` account with `role: "VENDOR"` and `email: vendor.email`.

---

## 🛡️ Takeover Safety Guard

If an existing account is registered under `vendor.email`, `acceptVendorInvite()` throws an error to prevent account hijacking:
```typescript
if (existing) {
  return { success: false, error: "An account already exists for this email. Please contact us to enable vendor access." };
}
```
