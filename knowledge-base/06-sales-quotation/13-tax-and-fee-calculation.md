# Tax & GST Calculation Model

## Overview

Veloria Grand enforces Indian GST tax compliance across all venue and catering quotations via the `VenueTaxSlab` model.

---

## Tax Rules & Calculations

- **Standard GST Rate**: 18% (9% CGST + 9% SGST for intra-state bookings).
- **Taxable Subtotal**: Calculated on net value after applying all discounts.
- **Tax Storage**: Stored in `SalesQuotation.taxAmount` and `Quote.taxAmount`.
- **Display**: Expressed separately on quotation breakdown and public viewer page.
