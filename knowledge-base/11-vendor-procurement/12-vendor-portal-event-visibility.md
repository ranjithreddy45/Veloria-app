# 12 - Vendor Portal Event Visibility

---

## 👁️ Scoped Event Query Logic

`getVendorEvents()` in `src/actions/vendor-portal.actions.ts` filters event visibility strictly by vendor identity:

```typescript
const vendor = await getCurrentVendor(session.user.email);
const assignments = await prisma.bookingVendor.findMany({
  where: { vendorId: vendor.id, booking: whereBooking },
  include: { booking: { select: { id: true, bookingNumber: true, eventName: true, date: true, timeSlot: true, venue: true } } }
});
```

---

## 🚫 Data Isolation Assurance

Vendors can ONLY view bookings where they have an explicit `BookingVendor` row or an `OperationVendorAssignment` row bound to `vendorId`. They cannot see other vendors' assignments or client financials.
