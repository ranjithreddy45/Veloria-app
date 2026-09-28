# LEAD NOTES & COMMENTS FORENSICS

## 1. Notes Panel (`CrmNotesPanel`)

Implemented in [crm-notes-panel.tsx](file:///Users/fci/Documents/Veloria-app/src/components/crm/crm-notes-panel.tsx).

- **Features**: Rich text note entry, pinned notes, team member `@mentions`.
- **Server Action**: `createCrmNote()`
- **Persistence**: Saved in `CrmNote` model linked to `leadId`.
