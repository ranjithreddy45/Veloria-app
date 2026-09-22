# 29 Portal & Public Experience Audit

`CODE VERIFIED`

## Public Link Audit Tracking

- **Quotation View Log (`QuoteView`)**: Captures exact timestamp, IP address, and browser User-Agent every time a public link `/q/[token]` is rendered.
- **Digital E-Sign Log (`SignatureRequest`)**: Stores cryptographic hash of signed canvas image, IP, User-Agent, and timestamp.
- **Vendor Assignment Confirmation**: Logs vendor IP address and confirmation timestamp when acknowledging work orders via public token `/vendor-confirm/[token]`.
