# LEAD FIELD-LEVEL FORENSICS

## 1. Field Master Inventory

| Field ID | Label | Name | Type | Required | Validation Rule |
|---|---|---|---|---|---|
| **FIELD-0601** | `Full Name` | `name` | Text | Yes | `min(2, "Name must be at least 2 characters")` |
| **FIELD-0602** | `Phone Number` | `phone` | Tel/Text | Yes | Valid Indian phone format (`/^[6-9]\d{9}$/`) |
| **FIELD-0603** | `Email Address` | `email` | Email | No | Email format if provided |
| **FIELD-0604** | `Event Date` | `eventDate` | Date Picker | No | Future date validation |
| **FIELD-0605** | `Guest Count` | `guestCount` | Number | No | Minimum 1 guest |
| **FIELD-0606** | `Estimated Budget` | `budget` | Number | No | Non-negative numeric value |
| **FIELD-0607** | `Lead Source` | `source` | Select | Yes | Enum (`WEBSITE`, `WHATSAPP`, `REFERRAL`, `WALK_IN`, `PHONE`) |
| **FIELD-0608** | `Lead Status` | `status` | Select | Yes | Enum (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_SENT`, `WON`, `LOST`) |
