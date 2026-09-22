# Quotation Detail & Editor Component Breakdown

## Overview

Interface components powering quotation inspection, version editing, line-item adjustments, and PDF generation.

---

## Component Inventory (`src/app/(dashboard)/quotations/_components/`)

- `quotation-detail.tsx`: Main layout displaying quote metadata, version history, and status banners.
- `quotation-calculator.tsx`: Interactive pricing workspace for editing per-plate rates, add-on items, and discounts.
- `tier-builder.tsx`: Builder component for configuring Silver, Gold, and Platinum package variants.
- `date-demand-banner.tsx`: Displays real-time date demand multipliers (e.g., "High Demand Date: +15% Surge").
- `quote-radar-panel.tsx`: Real-time view analytics dashboard showing public quote views, dwell times, and client devices.
- `slot-block-card.tsx`: Temporary venue slot hold control card.
