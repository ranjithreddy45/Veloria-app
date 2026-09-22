# 02 - Vendor Management Business Purpose

---

## 🎯 Commercial Objectives

The Vendor Management & Procurement system serves four vital business objectives for Veloria Grand:

1. **Vendor Quality & Governance**: Maintaining a verified directory of external vendors (`CATERING`, `DECORATION`, `PHOTOGRAPHY`, `AV`, etc.) with contact, GSTIN, and performance rating metrics.
2. **Operational Alignment & SLA Enforcement**: Formalizing vendor engagements via structured `WorkOrder` documents specifying setup/teardown times, scope of work, and e-signatures.
3. **Supply Chain & Inventory Procurement**: Streamlining venue procurement through structured `PurchaseRequisition` flows with maker-checker controls to prevent rogue purchasing.
4. **Financial Control & Accruals**: Automating Accounts Payable accruals in the General Ledger upon goods receiving (`postPurchaseReceivedWithinTx`) and bill approval (`approveVendorBill`).

---

## 🔍 Code-Grounded Verification Summary

- **Vendor Catalog & Bidding**: Vendors publish `VendorPackage` offerings and respond to event RFQs via `VendorBid`.
- **Portal Onboarding**: Staff generate tokenized invite links (`generateVendorPortalInvite`) allowing vendors to activate their accounts (`/vendor-activate`) securely.
- **Maker-Checker Security**: Approvers cannot approve purchase requisitions or vendor bills they created (`requestedById !== u.id`, `createdById !== u.id`).
