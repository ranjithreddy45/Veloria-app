# 16 - Contract to Booking Conversion Workflow

---

## 📑 Contract Promotion Mechanics

While a `SalesQuotation` creates the initial `Booking` structure, the `Contract` represents the legal execution phase:

```
CODE VERIFIED FLOW:
1. Client accesses public signing portal at `/sign/[token]`.
2. Client completes HTML5 Canvas signature pad (`sign-pad.tsx`).
3. Action `signContract(token)` updates `Contract.status = SIGNED` and sets `isLocked = true`.
4. Action queries linked `Booking` (`contract.bookingId`).
5. If `Booking.status == HOLD`, it is updated to `CONFIRMED`.
6. Event operations handoff notification is dispatched to Banquet Operations team.
```
