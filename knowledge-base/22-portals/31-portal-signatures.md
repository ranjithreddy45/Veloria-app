# 31 Public Contract Signatures & Document Locking

`CODE VERIFIED`

## Digital Signature Integrity & Document Locking

- When a contract is signed via `/sign/[token]` or `/portal/contracts/[id]`, `signature-public.actions.ts` captures the signature PNG.
- Contract model field `isLocked` is updated to `true`.
- Any subsequent attempt to edit contract terms, pricing, or annexures throws a validation error (`Contract is locked and cannot be modified`).
- Signed PDF with embedded signature image and timestamp footer is saved to S3.
