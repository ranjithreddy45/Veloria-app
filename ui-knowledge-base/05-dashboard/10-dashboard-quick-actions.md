# DASHBOARD QUICK ACTIONS FORENSICS

## 1. Quick Action Inventory

Quick actions are accessible directly from the Global Header (`+ Create` button) or embedded on dashboard action bars.

---

## 2. Detailed Quick Actions

| Action ID | Action Label | Trigger Location | Target Modal / Route | Server Action Invoked |
|---|---|---|---|---|
| **ACTION-0501** | `New Enquiry` | Header / Dashboard | `<NewLeadDialog />` | `createLeadAction()` |
| **ACTION-0502** | `New Quotation` | Header / Dashboard | `/quotations/new` | `createQuotationAction()` |
| **ACTION-0503** | `New Booking` | Header / Dashboard | `/bookings/new` | `createBookingAction()` |
| **ACTION-0504** | `Record Payment` | Dashboard / Finance | `<RecordPaymentDialog />` | `recordPaymentAction()` |
| **ACTION-0505** | `Create Task` | Dashboard Header | `<NewTaskDialog />` | `createTaskAction()` |
