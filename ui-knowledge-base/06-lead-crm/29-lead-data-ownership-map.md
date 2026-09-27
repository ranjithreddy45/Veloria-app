# LEAD DATA OWNERSHIP MAP

## 1. Database Entity Mapping

| UI Component | Server Action | Prisma Model(s) | Primary Fields |
|---|---|---|---|
| `LeadsTable` | `getLeads()` | `Lead`, `User` | `name`, `phone`, `status`, `assignedTo` |
| `LeadInlineFields` | `updateLead()` | `Lead` | `guestCount`, `eventDate`, `budget` |
| `CrmNotesPanel` | `createCrmNote()` | `CrmNote` | `content`, `authorId`, `leadId` |
| `LeadSiteVisits` | `scheduleSiteVisit()`| `SiteVisit` | `visitDate`, `status`, `hallId` |
