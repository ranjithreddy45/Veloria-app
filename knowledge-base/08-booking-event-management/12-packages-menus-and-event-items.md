# 12 - Packages, Menus & Event Items

---

## 🍽️ Event Item & Menu Structure

- **`BookingMenu`**: Linked 1:1 with `Booking`, storing selected menu items, welcome drinks, starters, main courses, desserts, live counters, and dietary badges.
- **Tasting Sessions (`Tasting`)**: Managed via `src/actions/tasting.actions.ts`. Tracks tasting dates, selected dishes, client feedback ratings, and chef notes prior to locking final event menus (`servicesLockedAt`).
- **Add-on Services (`BookingAddon` / `BookingVendor`)**: Captures extra operational services such as DJ setup, fireworks permit, valet parking team, extra security personnel, or specialty lighting.
