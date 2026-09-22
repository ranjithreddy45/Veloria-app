# 13 Vendor Assignment, Work Orders & Confirmations

`CODE VERIFIED`

## Work Order & Assignment Lifecycle

```
Procurement Manager -> Create WorkOrder -> Assign Vendor -> Send Assignment Link
Vendor Click -> GET /public/vendor-confirm/[token] or /vendor-portal/events
Vendor Action -> Click 'Acknowledge & Confirm' -> Update WorkOrder.status = 'CONFIRMED'
Event Date -> Vendor Executes Service -> Submits VendorBill -> Procurement Approves
```

### Public Token Confirmation (`/vendor-confirm/[token]`)
External vendor staff who do not have an active portal login can acknowledge assignments directly via high-entropy confirmation tokens using `public-vendor-confirm.actions.ts`.
