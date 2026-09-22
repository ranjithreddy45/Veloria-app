# 04 API Route Inventory

`CODE VERIFIED`

## API Handler Inventory

The Reimbursements subsystem primarily relies on Next.js 15 Server Actions (`src/actions/hr-reimbursement.actions.ts`) rather than dedicated REST API routes.

However, attachment streaming and file retrieval interact with generic file storage routes:
- `GET /api/files/[...key]`: Retrieves stored claim attachment files from AWS S3 or local object storage after verifying NextAuth user permissions.
