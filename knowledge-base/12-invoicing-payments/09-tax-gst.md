# 09 - GST & Tax Rules Engine

---

## 🏛️ Indian GST Rules (`src/lib/finance/tax.ts`)

- **Home State Code**: `"36"` (Telangana - Veloria Grand HQ).
- **Intrastate Supply (Customer State == Venue State = "36")**:
  - `CGST` = 9%
  - `SGST` = 9%
  - `IGST` = 0%
- **Interstate Supply (Customer State != Venue State)**:
  - `IGST` = 18%
  - `CGST` = 0%
  - `SGST` = 0%
- **Default SAC Code**: `996332` (Accommodation, food, and beverage services provided by banquet halls).
