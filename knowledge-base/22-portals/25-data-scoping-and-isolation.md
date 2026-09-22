# 25 Data Scoping, Tenant Isolation & IDOR Defense

`CODE VERIFIED`

## Security Audit: Tenant & Record Isolation

To prevent Insecure Direct Object Reference (IDOR) vulnerabilities, every portal query enforces strict identity-to-record boundaries.

### Query Scoping Rules

1. **Client Portal Scoping**:
   ```typescript
   // WRONG (IDOR Vulnerable):
   const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

   // SECURE (Enforced in src/actions/portal.actions.ts):
   const session = await auth();
   const contact = await prisma.contact.findFirst({ where: { email: session.user.email } });
   const booking = await prisma.booking.findFirst({
     where: { id: bookingId, contactId: contact.id }
   });
   ```

2. **Vendor Portal Scoping**:
   ```typescript
   const session = await auth();
   const workOrders = await prisma.workOrder.findMany({
     where: { vendorId: session.user.vendorId }
   });
   ```

3. **Public Tokenized Scoping**:
   ```typescript
   const link = await prisma.quoteShareLink.findFirst({
     where: { token, expiresAt: { gt: new Date() }, isRevoked: false }
   });
   ```
