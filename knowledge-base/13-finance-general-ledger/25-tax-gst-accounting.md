# 25 Statutory Tax & GST Accounting

## GST Calculation Rules (`src/lib/finance/tax.ts`)

- **Intra-state Supply** (Venue State == Customer State):
  - CGST: 9%
  - SGST: 9%
- **Inter-state Supply** (Venue State != Customer State):
  - IGST: 18%

---

## Tax Accounts

- `2210`: CGST Output Tax Payable
- `2220`: SGST Output Tax Payable
- `2230`: IGST Output Tax Payable
