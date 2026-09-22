# Quotation to Contract Progression

## Overview

Detailed field mappings and progression logic from an accepted `SalesQuotation` to a formal `Contract` agreement.

---

## Field Mapping Matrix

| Quotation Field | Contract Field | Transformation / Rule |
|---|---|---|
| `SalesQuotation.clientName` | `Contract.signerName` | Client full name |
| `SalesQuotation.clientEmail` | `Contract.signerEmail` | Signer email recipient |
| `SalesQuotation.grandTotal` | Contract Body Placeholder | `{{totalAmount}}` substitution |
| `SalesQuotation.eventDate` | Contract Body Placeholder | `{{eventDate}}` substitution |
| `SalesQuotation.id` | Reference Key | Linked as upstream quotation source |
