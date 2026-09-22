# 28 S3 Signed URLs & File Access Controls

`CODE VERIFIED`

## S3 Document Access Control

- All sensitive documents (contracts, financial receipts, ID proofs) are stored in private AWS S3 buckets.
- File URLs stored in database are private keys (e.g. `contracts/2026/ct_99812.pdf`).
- When a portal user requests a document download, `/api/documents/[id]` verifies session ownership and generates a time-bound presigned S3 URL valid for 15 minutes (`expiresIn: 900`).
- Direct public access to S3 bucket objects is blocked via bucket policy.
