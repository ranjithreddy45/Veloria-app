# 47 Gaps & Manual Verification Items

## Summary of Verification Items

1. **Live NIC E-Invoicing API**: `REQUIRES MANUAL VERIFICATION` - Database models and mock adapter exist, but live sandbox/production GSTN API credentials need verification.
2. **Automated Inventory Stock Consumption GL Posting**: `NOT IMPLEMENTED` - Stock deduction in kitchen/inventory modules does not generate automatic debit/credit journal entries.
3. **Statutory Tax Portal Submission**: `PARTIALLY IMPLEMENTED` - System computes CGST/SGST/IGST and exports summaries, but direct auto-filing to GST portal is not connected.
