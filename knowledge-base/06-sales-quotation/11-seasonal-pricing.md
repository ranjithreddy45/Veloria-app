# Dynamic Seasonal & Yield Pricing Rules

## Overview

Dynamic pricing rules (`PricingRule` model & `PricingRuleType` enum) adjust pricing dynamically based on season, day of week, peak hours, early bird booking, and demand signals.

---

## Rule Types (`PricingRuleType` Enum)

- `SEASONAL`: High-season (e.g. Wedding Season Oct-Feb) vs Off-peak multipliers.
- `DAY_OF_WEEK`: Weekend premium (Saturday/Sunday) vs weekday rates.
- `PEAK_HOUR`: Evening/Dinner slot vs Lunch slot rate adjustments.
- `EARLY_BIRD` / `LAST_MINUTE`: Lead time booking windows (`minDaysAhead`).
- `OCCUPANCY` / `DEMAND`: Real-time date availability surge pricing.

---

## Data Model & Logic

- **`PricingRule`**: Defines `ruleType`, `multiplier` (e.g. 1.15 for 15% surge), `startDate`, `endDate`, `dayOfWeek`, `priority`.
- **UI Management**: Managed in `/pricing`, `/pricing/demand`, and `/pricing/yield`.
