# 26 - Payment to GL Bridge Execution

---

## ⚡ Execution Bridge Details (`postPaymentReceived`)

- **Idempotency Tag**: `sourceModule = "RECEIVABLE"`, `sourceRefId = "PAY:<paymentId>"`.
- **Duplicate Protection**: `alreadyPosted()` checks if a journal entry exists before posting.
- **Fail-Safe**: Non-blocking best-effort execution (`.catch(err => reportSystemFailure(...))`).
