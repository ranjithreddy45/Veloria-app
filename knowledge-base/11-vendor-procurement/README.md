# Veloria Grand - Chunk 11: Vendor & Procurement Knowledge Base

---

## 📌 Module Overview

This directory contains the complete, code-grounded documentation for **Chunk 11: Vendor & Procurement** of the Veloria Grand platform.

### Scope
- **Vendor Master & Catalog**: Vendor profiles, deduplication, catalog packages, and ratings.
- **Vendor Portal & Onboarding**: Tokenized invitation, account activation, event visibility, assignment response, and marketplace bidding.
- **Vendor Work Orders**: Contract generation (`WO-YYYY-NNN`), status lifecycle, e-signature execution, advance payment release.
- **Procurement & Requisitions**: Purchase Requisition creation (`PR-YYYY-NNN`), maker-checker approval controls, goods receipt (`markReceived`).
- **Financial Accruals & Bills**: Vendor Bill creation (`VB-YYMM-####`), maker-checker approval, automated GL expense accruals, and advance netting.

---

## 📂 Topic Documents Index

1. `01-vendor-procurement-overview.md` - Subsystem architecture & diagram
2. `02-vendor-management-business-purpose.md` - Business & commercial purpose
3. `03-vendor-procurement-route-and-navigation-map.md` - Complete dashboard & portal route map
4. `04-vendor-master-and-profile.md` - Vendor model schema & deduplication logic
5. `05-vendor-creation-and-onboarding.md` - Onboarding flow & portal invite setup
6. `06-vendor-status-and-lifecycle.md` - Status enum states & transitions
7. `07-vendor-categories-and-classification.md` - 13 trade category classifications
8. `08-vendor-documents-and-compliance.md` - Compliance JSON documents & GSTIN
9. `09-vendor-contracts-and-commercial-information.md` - Work order vs BD acquisition contracts
10. `10-vendor-portal-overview.md` - Self-service portal architecture
11. `11-vendor-portal-authentication-and-access.md` - Portal auth, VENDOR role, invite activation
12. `12-vendor-portal-event-visibility.md` - Vendor multi-tenant data isolation
13. `13-vendor-event-assignment.md` - BookingVendor commercial junction
14. `14-operation-vendor-assignment.md` - OperationVendorAssignment operational dispatch
15. `15-vendor-work-order-overview.md` - WorkOrder model schema
16. `16-vendor-work-order-creation.md` - Work order generation & sequential numbering
17. `17-vendor-work-order-lifecycle.md` - Work order state machine & concurrency guards
18. `18-vendor-work-order-acceptance-and-decline.md` - Acceptance & decline audit trails
19. `19-vendor-work-order-e-signature.md` - Digital signature execution & advance release
20. `20-vendor-setup-and-teardown-tracking.md` - On-site timeline tracking & reminders
21. `21-vendor-event-execution.md` - Event-day execution & SLA incident logging
22. `22-purchase-requisition-overview.md` - PurchaseRequisition model schema
23. `23-purchase-requisition-creation.md` - PR creation & sequential numbering
24. `24-purchase-requisition-items.md` - PR line items schema
25. `25-purchase-requisition-approval.md` - PR maker-checker approval controls
26. `26-purchase-order-analysis.md` - Analysis of PO model vs PR lifecycle
27. `27-goods-receipt-and-receiving.md` - Goods receipt execution & item stamping
28. `28-procurement-to-inventory.md` - Procurement to inventory boundaries
29. `29-procurement-to-general-ledger.md` - Automated GL receipt accrual bridge (5230/2010)
30. `30-vendor-bill-overview.md` - VendorBill model schema
31. `31-vendor-bill-creation-and-submission.md` - Vendor bill creation & booking line guard
32. `32-vendor-bill-approval.md` - Vendor bill maker-checker approval controls
33. `33-vendor-bill-to-general-ledger.md` - Vendor bill GL accrual posting & advance netting
34. `34-vendor-payment-and-settlement.md` - Payout settlement clearing payable
35. `35-procurement-notifications-and-reminders.md` - Procurement alerts & notifications
36. `36-vendor-notifications-and-communications.md` - Work order & WhatsApp reminder dispatch
37. `37-vendor-permissions-and-role-access.md` - RBAC permission matrix
38. `38-vendor-procurement-database-model.md` - Database ERD & models
39. `39-vendor-procurement-server-actions-and-api.md` - Server Action registry table
40. `40-vendor-procurement-validation-and-business-rules.md` - Core business rules & constraints
41. `41-vendor-procurement-integrations.md` - External & internal subsystem integrations
42. `42-vendor-procurement-automation-and-crons.md` - Vendor setup reminder cron job
43. `43-vendor-procurement-end-to-end-user-journeys.md` - End-to-end user journeys
44. `44-vendor-procurement-feature-dependency-map.md` - Feature dependency matrix
45. `45-vendor-procurement-brief-vs-code-traceability.md` - Autopilot brief comparison
46. `46-vendor-procurement-gaps-and-verification.md` - Verified implementation gaps
47. `47-complete-vendor-procurement-feature-index.md` - Granular feature catalog index (`VENDOR-001` to `PROC-008`)
