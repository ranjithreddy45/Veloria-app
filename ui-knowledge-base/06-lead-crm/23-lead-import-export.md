# LEAD IMPORT & EXPORT FORENSICS

## 1. CSV Lead Importer (`/leads/import`)

Implemented in [lead-import-client.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/import/_components/lead-import-client.tsx).

- **File Types**: `.csv`, `.xlsx`.
- **Field Mapping UI**: Drag-and-drop column mapping (CSV header ──► Lead field).
- **Validation**: Pre-validates duplicate phone numbers and invalid email formats before executing `importLeadsAction()`.
