# 02 - BEO & Operations Business Purpose

---

## 🎯 Operational Business Objectives

```
CODE VERIFIED BUSINESS BEHAVIOR:
1. Eliminate miscommunication between sales and banquet execution by auto-populating BEO function sheets directly from confirmed booking records (`createBeo`).
2. Enforce strict headcount integrity (`coversSource`) so kitchen prep and staffing ratios align accurately with agreed guarantees or confirmed RSVPs.
3. Lock operational commitments (`setBeoStatus('LOCKED')`) prior to event day to prevent unauthorized menu changes or cost overruns.
4. Monitor venue operational readiness (`getOperationReadinessForBooking`) across kitchen, decor, seating, AV, and staffing dimensions.
5. Provide real-time event-day incident tracking (`BeoIncident`) and emergency protocol execution (`reportIncident`).

INFERRED BUSINESS PURPOSE:
- Tracks actual food cost vs estimated food cost (`estFoodCost` vs `actualFoodCost` in `KitchenPlan`) to measure banquet gross margins.
```

---

## 🔄 Cross-Module Operational Flow

| Source Module | Operational Handoff Mechanics | Evidence |
|---|---|---|
| **Booking Module** | Confirmed booking triggers BEO sheet creation & venue readiness checklist | `src/actions/beo.actions.ts` |
| **Kitchen & Catering** | BEO headcount & selected menu generate batch kitchen prep plans | `src/actions/kitchen.actions.ts` |
| **Vendors & Procurement** | BEO add-ons generate vendor work orders and on-site arrival schedules | `src/actions/work-order.actions.ts` |
| **Guest Portal & Seating** | Guest RSVP count updates BEO `RSVP_CONFIRMED` covers; seating grid feeds layout | `src/actions/seating.actions.ts` |
| **HR & Shift Scheduling** | Event timeline generates staff shift assignments (`Shift`) and hourly tracking | `src/actions/event-day.actions.ts` |
