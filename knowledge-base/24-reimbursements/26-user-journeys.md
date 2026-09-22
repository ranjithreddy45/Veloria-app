# 26 End-to-End User Journeys

`CODE VERIFIED`

## User Journey Scenarios

### Journey A: Fuel Claim Approval & Settlement
1. Employee submits 40L fuel claim on `/me/reimbursements`.
2. System validates 40L <= 50L monthly cap -> Saves claim (`status: PENDING`).
3. Level 1 approver receives email -> Approves on `/me/approvals`.
4. Level 2 (Sales HR) receives email -> Approves -> Status updates to `APPROVED`.
5. Finance marks claim paid on `/finance/reimbursements` with UTR number -> Status updates to `PAID`.
