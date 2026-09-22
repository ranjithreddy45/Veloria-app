# 37 Financial Audit Trail & Compliance

## Audit Attributes

Every `FinJournalEntry` records:
- `createdBy`: User ID / System Agent
- `createdAt`: ISO Timestamp
- `sourceModule`: Originating system module
- `sourceId`: Foreign ID of originating business document
- `reversalOfId`: Parent transaction ID if reversing
