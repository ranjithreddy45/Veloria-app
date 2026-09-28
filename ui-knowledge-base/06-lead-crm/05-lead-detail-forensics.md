# LEAD DETAIL WORKSPACE FORENSICS (`/leads/[leadId]`)

## 1. Detail Screen Workspace Layout

Defined in [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/[leadId]/page.tsx).

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Leads        Rahul & Priya Wedding            │
│  [ Status Select ]  [ Quality Select ]  [ Quick Actions ]│
├──────────────────────────────┬───────────────────────────┤
│ LEFT PANEL (8 cols)          │ RIGHT PANEL (4 cols)      │
│ - Lead Overview & Fields     │ - AI Lead Score Card      │
│ - Event & Venue Details      │ - Assigned Owner Card     │
│ - CRM Notes Panel            │ - Site Visit Schedule     │
│ - Activity & Comms Timeline  │ - Tasks & Reminders       │
└──────────────────────────────┴───────────────────────────┘
```

---

## 2. Section Inventory

1. **Header Action Bar**: Contains `LeadStatusSelect`, `LeadQualitySelect`, and `LeadQuickActions` dropdown ("Create Quotation", "Schedule Visit", "Convert").
2. **Inline Fields Card**: `LeadInlineFields` allowing live inline editing of guest count, event date, venue preference, and budget.
3. **AI Score Card**: `AiScoreCard` displaying AI lead score (0-100), intent tier, and key conversion signals.
4. **Notes Panel**: `CrmNotesPanel` for adding logged notes and team comments.
5. **Site Visits Panel**: `LeadSiteVisits` showing scheduled site visit slots with `ScheduleSiteVisitDialog`.
