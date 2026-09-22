# Quotation Grand Total Calculation

## Overview

Summary of final total formulas, rounding rules, and currency representations.

---

## Formula

$$\text{Grand Total} = (\text{Subtotal} \times \text{Demand Multiplier} - \text{Discount}) + \text{GST Tax}$$

---

## Currency & Precision

- **Precision**: All financial fields use `Decimal(12, 2)` in PostgreSQL / Prisma to prevent floating-point inaccuracies.
- **Currency**: Default INR (`₹`).
