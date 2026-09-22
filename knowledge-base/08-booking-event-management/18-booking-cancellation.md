# 18 - Booking Cancellation & Hold Release

---

## ❌ Cancellation Workflow (`cancelBooking`)

```typescript
// CODE VERIFIED: src/actions/booking.actions.ts
export async function cancelBooking(bookingId: string, reason: string): Promise<void> {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      internalNotes: `Cancelled: ${reason}`
    }
  });

  // Release timeSlot availability
  // Notify client and accounting team
}
```

- **Automated Hold Expiry Sweeper**: `/api/cron/hold-expiry` periodically queries `Booking` records with `status == 'HOLD'` where `holdExpiresAt < NOW()`, automatically transitioning them to `CANCELLED` and freeing up property date availability.
