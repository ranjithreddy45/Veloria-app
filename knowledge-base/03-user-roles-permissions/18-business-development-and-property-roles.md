# Role Family Deep Dive: Business Development & Property Roles

## Overview

Manages venue acquisition, property records, landlord agreements, and business development prospects.

---

## Role Profiles

### 1. BD_EXECUTIVE & BD_HEAD
- **Exact Code Values**: `"BD_EXECUTIVE"`, `"BD_HEAD"`
- **Function**: Identify new venue opportunities, manage corporate partnerships, negotiate commercial terms.
- **Key Permissions**: `bd:read`, `bd:create`, `bd:edit`, `prospects:manage`. `BD_HEAD` has approval authority over BD deals.

### 2. PROPERTY_MANAGER
- **Exact Code Value**: `"PROPERTY_MANAGER"`
- **Function**: Maintain property master data, manage venue leases, oversee property maintenance and compliance.
- **Key Permissions**: `property:read`, `property:create`, `property:edit`, `maintenance:manage`.

---

## Code References

- `src/lib/actions/property.ts`
- `src/lib/actions/bd.ts`
