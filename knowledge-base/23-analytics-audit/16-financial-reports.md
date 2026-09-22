# 16 Financial Reports Engine & Tally Integration

`CODE VERIFIED`

## Report Generation Specifications (`src/actions/finance-tally.actions.ts`)

- **Tally Prime XML Export**: Formats General Ledger journal entries into Tally XML schema for external auditor import.
- **GST Report**: Aggregates Output GST (Invoices) and Input Tax Credit (Vendor Bills) by GSTIN.
- **Event Profitability Report**: Itemized P&L per event (`Booking Revenue - (Vendor Costs + Food Cost + Overhead Allocations)`).
