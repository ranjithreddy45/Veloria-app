# 13 - Booking Pricing & Commercial Structure

---

## 💰 Financial Breakdown & Commercial Fields

A `Booking` record maintains explicit commercial fields to prevent pricing drift:

```typescript
// CODE VERIFIED: prisma/schema.prisma (Booking model)
totalAmount: Decimal      // Gross contracted booking value
currency: String         // Default "INR"
perPlatePrice: Decimal?   // Rate per plate/person
hallRental: Decimal?      // Fixed hall/space rental fee
decorCharges: Decimal?    // Mandated or custom decor fee
otherServices: Decimal?   // Total add-on services amount
```

- **Invoicing Integration**: `createBookingInvoiceFromQuotation` reads these exact commercial fields to generate advance milestone tax invoices (`Invoice`).
