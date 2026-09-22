# 09 - Vendor Contracts & Commercial Information

---

## 📜 Vendor Commercial Structure

Vendors interact commercially with Veloria Grand through two mechanisms:
1. **Catalog Package Pricing**: Managed via `VendorPackage` & `VendorPackageItem`. Defines base rates (`PER_PLATE`, `PER_EVENT`, `PER_PIECE`, `PER_HOUR`, `PER_DAY`).
2. **Event Work Orders (`WorkOrder`)**: Specific legal agreements per booking specifying scope, total agreed cost, advance amount, setup/teardown constraints, and e-signatures.

---

## 🔗 Distinction from Property Acquisition Contracts

- **Acquisition Contracts (`AcqContract`)**: Managed under BD & Property Acquisition (`Module 20`) for hall/property owner leases.
- **Event Vendor Work Orders (`WorkOrder`)**: Managed under Vendor Operations (`Module 11`) for event service execution.
