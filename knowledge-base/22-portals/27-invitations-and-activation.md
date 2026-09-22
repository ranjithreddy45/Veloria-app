# 27 Invitation Lifecycle & Token Hashing

`CODE VERIFIED`

## Invitation & Activation Flow

```
1. Admin triggers createPortalInvitation(email, role, targetId)
2. System generates random 32-byte hex token -> Stores tokenHash in DB
3. Token expiration set to 7 days from generation
4. WhatsApp & Email dispatched with link containing raw token
5. User clicks link -> Page invokes activateAccount(rawToken, password)
6. Server Action computes SHA-256(rawToken) and matches against database tokenHash
7. User record activated -> Password saved (bcrypt/argon2) -> Token invalidated
```
