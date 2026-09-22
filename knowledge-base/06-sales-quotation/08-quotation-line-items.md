# Quotation Line Items & Add-Ons

## Overview

Line items allow itemizing catering packages, venue rentals, decor upgrades, and audiovisual add-ons.

---

## Line Item Schema (`QuoteLineItem` Model)

- `id`: Unique identifier.
- `description`: Item or service description.
- `quantity`: Item quantity or guest count (`Decimal`).
- `unitPrice`: Base price per unit (`Decimal`).
- `amount`: Calculated subtotal (`quantity * unitPrice`).
- `category`: Category grouping (e.g. `Catering`, `Decor`, `AV`, `Hall Rental`).
- `order`: Display sorting sequence (`Int`).
