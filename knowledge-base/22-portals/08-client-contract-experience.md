# 08 Client Contracts & Digital E-Sign Experience (`/sign/[token]`)

`CODE VERIFIED`

## Digital Contract Signing Engine (`src/actions/signature-public.actions.ts`)

Clients sign venue contracts through either `/portal/contracts/[contractId]` (authenticated) or `/sign/[token]` (public tokenized).

### Signing Execution Flow

```
1. Client accesses /sign/[token]
2. System loads SignatureRequest & linked Contract
3. Client reviews HTML/PDF terms and annexures
4. Client signs on HTML5 Canvas pad or uploads image signature
5. Client clicks 'Confirm & Sign'
6. Server Action executeDigitalSignature() executes:
   a. Validates token expiry & signature non-null
   b. Saves base64 PNG signature to S3 storage bucket
   c. Records SignatureRequest (ipAddress, userAgent, signedAt, signatureUrl)
   d. Updates Contract.status = 'SIGNED' and isLocked = true
   e. Triggers PDF generation & sends copy via Email/WhatsApp
```

### Legal Audit Metadata

Every digital signature captures:
- Signer Full Name & Email
- Exact Timestamp (`signedAt` in UTC)
- IP Address & User Agent Header
- Cryptographic Signature Hash (`signatureHash`)
