# 44 Performance, Query Bottlenecks & Optimization

`CODE VERIFIED`

## Database Query Bottlenecks & Performance Rules

1. **Prisma Include Overhead**:
   - `/portal/bookings/[bookingId]` queries deeply nested relations (`venue`, `invoices`, `contracts`, `guestLists`, `beo`).
   - Mitigation: Use Prisma select projections (`select: { id: true, name: true }`) for light header views.

2. **S3 Presigned URL Generation**:
   - Batch generating S3 presigned URLs for gallery media (`/portal/gallery`) can slow down response time.
   - Mitigation: Generate presigned URLs on-demand or use CDN signed cookies.

3. **Token Lookup Indexing**:
   - High volume token lookups (`QuoteShareLink.token`, `SignatureRequest.token`, `PublicHold.token`) are optimized via `@unique` indexes in PostgreSQL schema.
