# PORTAL AUTHENTICATION & PUBLIC TOKEN ACCESS

## 1. Authenticated Portal vs Public Token Access

Veloria Grand maintains a strict distinction between **Authenticated Portal Sessions** and **Token-Based Public Experiences**.

```
AUTHENTICATION VECTOR ──┬──► SESSION-BASED PORTAL (Requires User Password Login)
                        │    - /portal (Client Portal)
                        │    - /vendor-portal (Vendor Portal)
                        │
                        └──► TOKEN-BASED PUBLIC ACCESS (No User Password Required)
                             - /q/[token] (Quotation Review & Sign)
                             - /sign/[token] (Contract E-Signature)
                             - /pay/[token] (Invoice Payment Gateway)
                             - /hold/[token] (Date Hold Confirmation)
```

---

## 2. Public Link Token Experiences

| Token Route | Source File | Purpose | Security Gate |
|---|---|---|---|
| `/q/[token]` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/q/[token]/page.tsx) | Client Quotation review & accept | Cryptographic quote token |
| `/sign/[token]` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/sign/[token]/page.tsx) | Contract E-Signature surface | Contract access token |
| `/pay/[token]` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/pay/[token]/page.tsx) | Guest invoice payment gateway | Invoice pay token |
| `/hold/[token]` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/hold/[token]/page.tsx) | Date hold confirmation screen | Date hold token |
