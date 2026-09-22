# 16 - Vendor Work Order Creation

---

## ✍️ Work Order Generation (`createWorkOrder`)

- **Server Action**: `createWorkOrder(bookingId, input)` in `src/actions/work-order.actions.ts`.
- **Sequential Numbering**: Allocates `WO-YYYY-NNN` using sequential year counts and retry handling for unique constraint collisions (`P2002`).
- **Permissions**: Gated on `vendors:assign` or `operations:update`.
- **Manual Generation**: BEO publication does NOT automatically issue Work Orders; staff generate work orders explicitly per vendor.
