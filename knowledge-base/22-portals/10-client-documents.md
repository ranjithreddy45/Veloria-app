# 10 Client Document Library & S3 Access (`/portal/documents`)

`CODE VERIFIED`

## Document Storage Architecture

Client documents (Signed Contracts, Final BEO PDFs, Invoices, Receipts, Floor Plans, Menu Specs) are stored in AWS S3 / Cloud Storage and accessed securely via signed URLs.

### Document Access Rules

- Clients can only access documents linked to their `Booking` or `ContactId`.
- API endpoint `/api/documents/[id]` validates NextAuth session and ownership before redirecting to an S3 presigned URL with a 15-minute expiration time (`expiresIn: 900`).
- Clients can upload specific documents (ID Proofs, Event Permits, Special Requests) from `/portal/documents`.
- Uploaded files are validated against allowed MIME types (`application/pdf`, `image/jpeg`, `image/png`) and capped at 10MB per file.
