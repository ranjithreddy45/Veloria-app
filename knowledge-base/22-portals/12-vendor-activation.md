# 12 Vendor Invitation & Account Activation (`/vendor-activate`)

`CODE VERIFIED`

## Vendor Activation Lifecycle (`src/actions/vendor-portal-invite.actions.ts`)

1. **Vendor Creation**: Internal Procurement Manager creates Vendor record and clicks "Invite to Portal".
2. **Token Generation**: System generates cryptographic `activationToken` (hashed using SHA-256) and sets `tokenExpiresAt = Date.now() + 7 * 86400000` (7 days).
3. **Dispatch**: Invitation sent via WhatsApp & Email containing activation URL (`/vendor-activate?token=...`).
4. **Activation Submission**:
   - Vendor enters password and verifies tax/bank details on `/vendor-activate`.
   - Server Action `activateVendorAccount()` validates token, hashes password, creates `User` record (`role = VENDOR`), links `Vendor.userId = User.id`, and clears token.
