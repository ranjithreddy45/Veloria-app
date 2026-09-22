# 07 Claim Creation & Submission Workflow

`CODE VERIFIED`

## Submission Flow (`submitReimbursement`)

1. Employee logs into `/me/reimbursements` and opens claim submission modal.
2. Employee selects Category (`TRAVEL`, `MEDICAL`, `TELEPHONE`, `FUEL`, `BOOKS`, `OTHER`).
3. Inputs Title, Claim Date, Amount (INR), Note, and optional file attachments.
4. If Category is `FUEL`, `fuelLiters` input becomes mandatory.
5. **Fuel Cap Check**: Server Action queries cumulative `fuelLiters` for the current calendar month. If `currentSum + newLiters > 50`, submission fails with error: `"Monthly fuel limit of 50 liters exceeded."`.
6. Attachments uploaded are validated against allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and total budget limit (10MB).
7. System saves claim (`status: PENDING`), writes `HrClaimEvent` (`SUBMITTED`), and notifies Level 1 approvers via in-app notification and email.
