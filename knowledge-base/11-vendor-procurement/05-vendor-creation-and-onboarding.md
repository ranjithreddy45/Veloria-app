# 05 - Vendor Creation & Onboarding

---

## 🔄 Vendor Onboarding Flow

```
[ Staff Creates Vendor ] ---> [ Status: PENDING_APPROVAL / ACTIVE ]
                                         |
                                         v
                            [ Generate Portal Invite ]
                            (generateVendorPortalInvite)
                                         |
                                         v
                            [ Activation Link Sent ]
                            (/vendor-activate?vendor=ID&token=TOKEN)
                                         |
                                         v
                            [ Vendor Sets Password ]
                            (acceptVendorInvite creates User role: VENDOR)
```

---

## 🛡️ Security & Account Creation Safeguards

- **Staff Permission**: Only users with `vendors:create` can add vendor master records; `vendors:update` is required to generate invite tokens.
- **Account Hijack Prevention**: `acceptVendorInvite()` explicitly blocks token activation if a `User` account already exists for that email address, preventing unauthorized account takeovers.
