# Automated Round-Robin Lead Distribution

## Overview

Veloria Grand automates lead assignment using an availability-aware round-robin distribution algorithm (`src/lib/lead-pipeline.ts`).

---

## Round-Robin Mechanics

1. **Rep Availability Check**: Queries `RepAvailability` model for active sales reps in the target venue/department who are currently online/on-shift.
2. **Workload Balancing**: Counts active assigned leads (`status IN [NEW, CONTACTED, QUALIFIED]`) to avoid overloading individual reps.
3. **Rotation Index**: Cycles through eligible reps in sequential order, persisting routing decisions in `LeadRoutingDecision`.
4. **Fallback Handling**: If no rep is available, assigns lead to Sales Manager (`SALES_HEAD`) or leaves `assignedToId = null` for manual queue pick-up.
