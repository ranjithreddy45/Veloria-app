# 19 - Vendor Work Order E-Signature

---

## ✍️ Digital Signature Execution (`signWorkOrder`)

- **Function**: `signWorkOrder(id, { signerName, signatureUrl })`.
- **Precondition**: Work order status must be `ACKNOWLEDGED`.
- **Signature Validation**: Signature URL is validated via `isSafeReceiptUrl()` to prevent malicious link injection.
- **State Lock**: Transition to `SIGNED` locks the work order details.

---

## 💸 Advance Payment Release (`releaseAdvance`)

Once a work order is `SIGNED`, staff can execute `releaseAdvance(id)`. This stamps `advanceReleasedAt` and dispatches a notification to Finance (`FINANCE` role users).
