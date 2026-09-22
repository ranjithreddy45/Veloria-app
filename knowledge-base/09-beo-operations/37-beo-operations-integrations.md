# 37 - BEO & Operations External & Internal Integrations

---

## 🔌 System Integrations

1. **PostgreSQL & Prisma ORM**: Relational persistence for `Beo`, `BeoIncident`, `KitchenPlan`, `WorkOrder`, `EventDayTimeline`.
2. **AWS S3 / Cloud Storage**: Document storage for rendered BEO PDFs and incident photo evidence (`TaskProof`, `photoUrl`).
3. **Resend Email API**: Vendor work order distribution and published BEO PDF dispatches.
4. **Meta WhatsApp Cloud API**: Real-time incident alerts, readiness watchdog dispatches, and event-day reminders.
5. **General Ledger & Finance**: Vendor bill accruals (`VendorBill`) posted automatically upon work order execution.
