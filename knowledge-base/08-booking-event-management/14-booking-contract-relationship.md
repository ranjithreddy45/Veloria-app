# 14 - Booking & Contract Relationship

---

## 📜 Contract Linkage Architecture

- **Relation**: A `Booking` can link to one or more `Contract` records (`prisma.contract.findMany({ where: { bookingId } })`).
- **Promotion Trigger**: When a `Contract` transitions to status `SIGNED`, a database trigger/action automatically promotes the associated `Booking` from `HOLD` to `CONFIRMED`.
- **Locking Effect**: Signing the legal contract freezes critical booking commercial terms (`totalAmount`, `perPlatePrice`, `hallRental`), locking them against unauthorized edits.
