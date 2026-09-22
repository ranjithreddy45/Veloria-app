# Package & Catalog System

## Overview

Pre-configured event packages (`EventPackage`, `VendorPackage`) and menu catalog items (`QuotePackageMenuItem`).

---

## Package Architecture

- **`EventPackage` Model**: Defines standard venue packages (e.g., "Grand Royal Wedding Package", "Corporate Seminar Package").
- **`PackageItem` Model**: Component items included in a package.
- **`PackageTier` Enum**: Package tiers (`SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`).
- **`QuotePackageMenuItem`**: Specific menu selections pre-configured for catering quotations.
