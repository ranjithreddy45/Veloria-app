# DASHBOARD FILTER FORENSICS

## 1. Dashboard Filtering Architecture

Filtering on Veloria Grand dashboard surfaces is implemented via URL query parameters and React server component re-rendering.

---

## 2. Filter Inventory

### FILTER-0501: Date Range Filter
- **UI Component**: Date Picker Popover / Preset Select
- **Query Params**: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Affected Widgets**: KPI cards, revenue charts, activity feed.

### FILTER-0502: Venue / Property Filter
- **UI Component**: Dropdown Select
- **Query Param**: `?venueId=...`
- **Affected Widgets**: Bookings count, event schedule, kitchen plans.
- **Default**: `"ALL_VENUES"` (All properties combined).

### FILTER-0503: Department / Rep Filter
- **UI Component**: User Select
- **Query Param**: `?repId=...`
- **Affected Widgets**: Sales pipeline KPIs, task checklist, lead conversion.
