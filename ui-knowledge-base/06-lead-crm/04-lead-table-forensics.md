# LEAD TABLE FORENSICS (`TABLE-0601`)

## 1. Table Specifications

Implemented in [leads-table.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/_components/leads-table.tsx).

- **Table ID**: `TABLE-0601`
- **Component Name**: `LeadsTable`
- **Selection**: Checkbox column supporting individual row selection and select-all.

---

## 2. Column Inventory

| Column Name | Data Field | Display Format | Interactive Behavior |
|---|---|---|---|
| **Lead Name** | `lead.name` | Bold text with avatar badge | Link navigating to `/leads/[leadId]` |
| **Contact Info** | `lead.email`, `lead.phone` | Subtext with phone/email icon | Clicking copy or click-to-dial |
| **Event Date** | `lead.eventDate` | Formatted date (`DD MMM YYYY`) | Sortable column |
| **Guest Count** | `lead.guestCount` | Numeric badge | Sortable column |
| **Budget** | `lead.budget` | Currency format (`₹XX,XXX`) | Sortable column |
| **Status** | `lead.status` | Color-coded Badge | Dropdown to update status inline |
| **Quality Score**| `lead.qualityScore` | `AiScoreCard` / Intent Badge | Displays lead scoring grade (Hot/Warm/Cold) |
| **Assigned Owner**| `lead.assignedTo` | Avatar + Name | Popover for inline owner re-assignment |
| **Actions** | N/A | Row Actions Dropdown (`...`) | Edit, Assign, Convert to Quote, Delete |
