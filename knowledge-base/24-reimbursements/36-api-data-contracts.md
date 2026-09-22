# 36 API & Data Contract Specifications

`CODE VERIFIED`

## Server Action Contract Example

### `submitReimbursement`
- **Input**: `{ category: "FUEL", title: "Site Visit Fuel", amount: 3500, claimDate: "2026-09-15", fuelLiters: 35 }`
- **Output**: `{ success: true, data: { id: "claim_10928" } }`
