# Phase 00: Interaction Inventory

## 1. Key User Interactions
1. **Public Quote Acceptance**: Client clicks "Accept Quote" on `/q/[token]` -> triggers soft hold creation & WhatsApp alert.
2. **Contract Signature Capture**: Client draws signature on canvas at `/sign/[token]` -> compiles PDF & stamps S3 object.
3. **BEO Read-Only Lock**: Event Manager clicks "Lock BEO" -> updates `isLocked = true` and disables form inputs.
4. **Razorpay One-Click Pay**: Payer clicks "Pay Now" on `/pay/[token]` -> opens Razorpay SDK overlay -> captures payment & posts GL entry.
5. **Biometric Log Sync Trigger**: Admin clicks "Sync Logs" -> fetches device payloads and updates `AttendanceRecord`.
6. **Payroll Execution**: HR Director clicks "Process Payroll" -> computes fixed 30-day denominator salary and posts salary GL journal.
