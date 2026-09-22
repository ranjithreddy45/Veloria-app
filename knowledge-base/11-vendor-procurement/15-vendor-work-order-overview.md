# 15 - Vendor Work Order Overview

---

## 📄 Work Order Model (`prisma.workOrder`)

A `WorkOrder` is a formal contractual agreement issued to a vendor for an event.

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique work order ID |
| `woNumber` | `String?` | `@unique` | Format: `WO-YYYY-NNN` |
| `bookingId` | `String` | Required | Target event booking |
| `vendorId` | `String` | Required | Assigned vendor master |
| `serviceType` | `String` | Required | E.g. "Catering", "Stage Lighting" |
| `scope` | `String?` | Optional | Detailed deliverables & SLA |
| `terms` | `String?` | Optional | Commercial terms & conditions |
| `advanceAmount` | `Decimal?` | Optional | Advance payment amount |
| `status` | `String` | `@default("DRAFT")` | `DRAFT`, `SENT`, `ACKNOWLEDGED`, `SIGNED`, `DECLINED` |
| `signerName` | `String?` | Optional | Full name of vendor signatory |
| `signatureUrl` | `String?` | Optional | Base64/S3 link to signature image |
