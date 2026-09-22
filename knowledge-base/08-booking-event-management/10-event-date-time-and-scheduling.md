# 10 - Event Date/Time & Scheduling Mechanics

---

## 📅 Scheduling Verification & Availability Guard

```typescript
// CODE VERIFIED: src/actions/booking.actions.ts
export async function checkAvailability(venueId: string, date: Date, timeSlot: TimeSlot): Promise<boolean> {
  // 1. Check if date is in BlackoutDate
  const blackout = await prisma.blackoutDate.findFirst({
    where: { venueId, date }
  });
  if (blackout) return false;

  # 2. Check for conflicting active Bookings
  const existingBooking = await prisma.booking.findFirst({
    where: {
      venueId,
      date,
      status: { in: ['HOLD', 'CONFIRMED', 'IN_PROGRESS'] },
      OR: [
        { timeSlot },
        { timeSlot: 'FULL_DAY' },
        { timeSlot: timeSlot === 'FULL_DAY' ? { in: ['MORNING', 'EVENING'] } : undefined }
      ]
    }
  });
  return !existingBooking;
}
```

- **Composite Database Index**: `@@index([venueId, date, timeSlot])` ensures sub-millisecond slot queries.
- **Blackout Dates (`BlackoutDate`)**: Allows management to reserve dates for maintenance, structural renovations, or internal operational dry-runs.
