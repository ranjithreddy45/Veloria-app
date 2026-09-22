# Contract Versioning System

## Overview

Property acquisition contracts (`AcqContract`) enforce strict revision history tracking via the `AcqContractVersion` model.

---

## Versioning Mechanics

- **`AcqContractVersion` Model**: Stores historical contract body snapshots (`version`, `body`, `createdById`, `createdAt`).
- **Document Locking**: Client signature requests (`SignatureRequest`) lock the body snapshot upon completion (`isLocked = true`), preventing any subsequent modification.
