# Digital Signature Mechanics & Signature Pad

## Overview

Veloria Grand implements native electronic signature capture (`src/lib/esign.ts` & `sign-pad.tsx`) supporting drawn mouse/touch signatures or typed name signatures.

---

## Signature Capture Modes (`SignatureType` Enum)

- `TYPED`: Signer types their legal name, rendered in a signature typeface.
- `DRAWN`: Signer draws their physical signature on the canvas pad (`sign-pad.tsx`), stored as a base64 Data-URL string in `signatureData`.
- **Audit Telemetry**: Captures `signedAt`, `signedIp` (IPv4/v6), and `signedUserAgent` for legal non-repudiation.
