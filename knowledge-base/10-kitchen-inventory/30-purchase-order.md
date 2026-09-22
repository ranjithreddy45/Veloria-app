# 30 - Purchase Order (PO) Management

---

## 🛒 Project Purchase Orders (`ProjectPurchaseOrder`)

- **Model**: `ProjectPurchaseOrder` in `prisma/schema.prisma`.
- **Fields**: `number` (e.g. `PO-2026-0045`), `projectId`, `workPackageId`, `vendorId`, `amount`, `status` (`DRAFT`, `ISSUED`, `RECEIVED`, `PAID`, `CANCELLED`).
- **Server Actions**: `src/actions/project-procurement.actions.ts` (`createPurchaseOrder`, `updatePurchaseOrderStatus`).
