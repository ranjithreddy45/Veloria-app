# 15 Vendor Payouts & Bill Tracking (`/vendor-portal/payouts`)

`CODE VERIFIED`

## Vendor Financial Dashboard

Vendors can track submitted bills (`VendorBill`) and issued payouts (`Payout`).

### Data Fields Exposed to Vendors
- **Bills**: Bill Number, Work Order Code, Event Date, Bill Amount, Tax Amount, Approval Status (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`).
- **Payouts**: Payout Reference, Payment Date, Mode (NEFT/RTGS/UPI), Amount Cleared, Bank UTR Number.
- **Bank Info**: Vendor can view and request updates to bank account & GSTIN credentials.
