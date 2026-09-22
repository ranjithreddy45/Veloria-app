# Role Family Deep Dive: Event & Operations Roles

## Overview

This role family manages venue bookings, event coordination, Banquet Event Orders (BEO), kitchen schedules, and inventory management.

---

## Role Profiles

### 1. EVENT_COORDINATOR
- **Exact Code Value**: `"EVENT_COORDINATOR"`
- **Function**: Coordinate event logistics, schedule venue setups, draft BEOs, communicate with clients.
- **Key Permissions**: `events:read`, `events:create`, `events:edit`, `beo:read`, `beo:create`, `beo:edit`.

### 2. OPERATIONS
- **Exact Code Value**: `"OPERATIONS"`
- **Function**: Execute daily venue operations, manage floor staff, coordinate kitchen tasks, log inventory usage.
- **Key Permissions**: `operations:read`, `operations:execute`, `kitchen:read`, `inventory:read`, `beo:read`.

### 3. OPERATIONS_HEAD
- **Exact Code Value**: `"OPERATIONS_HEAD"`
- **Function**: Oversee operational execution, approve BEO finalizations, approve procurement purchase orders, manage venue inventory.
- **Key Permissions**: Includes all `OPERATIONS` permissions plus `beo:approve`, `procurement:approve`, `inventory:manage`, `reports:operations`.

---

## Code References

- `src/lib/actions/event.ts`
- `src/lib/actions/beo.ts`
- `src/lib/actions/inventory.ts`
