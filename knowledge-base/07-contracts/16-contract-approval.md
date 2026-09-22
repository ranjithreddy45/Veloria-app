# Contract Legal & Executive Approval

## Overview

Internal review workflow for commercial property lease contracts (`AcqContract`) and non-standard client agreements.

---

## Approval Attributes

- `approvedById`: Foreign key to `User` model (Legal Officer or Admin).
- `approvedAt`: Timestamp of manager approval.
- `phase`: `AcqContractPhase` (`AUTHORING` -> `LEGAL_REVIEW` -> `EXECUTIVE_APPROVAL` -> `EXECUTED`).
