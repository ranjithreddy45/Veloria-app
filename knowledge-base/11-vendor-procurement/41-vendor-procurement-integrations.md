# 41 - Vendor Procurement Integrations

---

## 🔌 System Integrations

| Subsystem | Integration Point | Data Exchanged |
|---|---|---|
| **General Ledger** | `postPurchaseReceivedWithinTx` | Posts Dr Supplies Expense / Cr Accounts Payable on receipt |
| **General Ledger** | `approveVendorBill` | Posts Dr Event Expense / Cr Accounts Payable on bill approval |
| **Resend Email** | `vendor-portal-invite.actions.ts` | Dispatches activation & work order alert emails |
| **Meta WhatsApp API** | `vendor-reminders.ts` | Dispatches setup reminders 24 hours prior to event |
| **AWS S3** | Signature & Invoice Uploads | Stores base64 e-signatures and invoice PDF receipts |
