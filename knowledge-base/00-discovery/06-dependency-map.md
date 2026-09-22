# VELORIA GRAND — CROSS-MODULE & DATABASE DEPENDENCY MAP

---

## 📌 Dependency Architecture

- **Status Label**: `CODE VERIFIED`

---

## 🔗 Shared Model Reverse Dependency Summary

| Model | READ Capabilities | CREATE Capabilities | UPDATE Capabilities | Primary Related Models |
|---|---|---|---|---|
| `User` | `portal.actions.ts`, `auth.ts`, `staff.actions.ts` | `auth.actions.ts` | `user.actions.ts` | `Employee`, `Lead`, `Booking` |
| `Employee` | `hr-attendance-sheet.actions.ts`, `hr-payroll.actions.ts` | `hr-employee.actions.ts` | `hr-employee.actions.ts` | `User`, `AttendanceRecord`, `PayrollEntry` |
| `Lead` | `lead.actions.ts`, `pipeline.actions.ts`, `ai.actions.ts` | `lead-capture.ts` | `lead.actions.ts` | `Contact`, `SalesQuotation` |
| `Booking` | `booking.actions.ts`, `beo.actions.ts`, `handover.actions.ts` | `booking.actions.ts` | `booking.actions.ts` | `SalesQuotation`, `Venue`, `Invoice` |
| `Invoice` | `invoice.actions.ts`, `portal.actions.ts`, `gl-reconcile.ts` | `invoice.actions.ts` | `invoice.actions.ts` | `Booking`, `Payment`, `FinJournalEntry` |
| `Payment` | `payment.actions.ts`, `portal.actions.ts` | `payment.actions.ts` | `webhook/route.ts` | `Invoice`, `Booking`, `FinAccount` |
