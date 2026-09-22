# 39 - Vendor Procurement Server Actions & API

---

## ⚡ Complete Server Action Registry

| Action Name | Source File | Required Permission | Description |
|---|---|---|---|
| `getVendors` | `src/actions/vendor.actions.ts` | `vendors:read` | Paginated vendor directory query |
| `createVendor` | `src/actions/vendor.actions.ts` | `vendors:create` | Create vendor with dedup check |
| `generateVendorPortalInvite` | `src/actions/vendor-portal-invite.actions.ts` | `vendors:update` | Issue tokenized activation URL |
| `acceptVendorInvite` | `src/actions/vendor-portal-invite.actions.ts` | Public Token | Provision `role: VENDOR` account |
| `createWorkOrder` | `src/actions/work-order.actions.ts` | `vendors:assign` | Issue `WO-YYYY-NNN` work order |
| `signWorkOrder` | `src/actions/work-order.actions.ts` | `vendors:assign` | Execute e-signature on work order |
| `createPurchaseRequisition` | `src/actions/procurement.actions.ts` | `procurement:create` | Create `PR-YYYY-NNN` requisition |
| `approvePR` | `src/actions/procurement.actions.ts` | `procurement:update` | Approve PR (Maker-checker enforced) |
| `markReceived` | `src/actions/procurement.actions.ts` | `procurement:update` | Mark received & post GL accrual |
| `createVendorBill` | `src/actions/vendor-bill.actions.ts` | `payouts:create` | Create vendor invoice bill |
| `approveVendorBill` | `src/actions/vendor-bill.actions.ts` | `payouts:approve` | Approve bill & post GL expense accrual |
