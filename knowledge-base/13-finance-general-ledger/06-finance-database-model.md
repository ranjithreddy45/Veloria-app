# 06 Finance Database Models & Schema

## Primary Schema Models (`prisma/schema.prisma`)

### 1. `FinAccount`
Represents individual accounts in the Chart of Accounts.

- `id`: String (UUID, PK)
- `organizationId`: String
- `code`: String (Unique per organization)
- `name`: String
- `type`: `FinAccountType` (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`)
- `currentBalance`: Decimal (Default `0.00`)
- `isActive`: Boolean (Default `true`)
- `isSystem`: Boolean (Default `false`)
- `createdAt`, `updatedAt`: DateTime

---

### 2. `FinJournalEntry`
Represents double-entry journal headers.

- `id`: String (UUID, PK)
- `organizationId`: String
- `entryNumber`: String (Sequential, e.g. `JE-202609-0001`)
- `postingDate`: DateTime
- `sourceModule`: `FinSourceModule` (`MANUAL`, `RECEIVABLE`, `PAYABLE`, `PAYROLL`, `BANK`, `ASSET`, `TAX`)
- `sourceId`: String (Nullable, reference to Invoice, Payment, VendorBill, etc.)
- `narration`: String
- `status`: `FinJournalStatus` (`POSTED`, `REVERSED`)
- `reversalOfId`: String (Nullable, references reversed entry)
- `createdBy`: String
- `createdAt`, `updatedAt`: DateTime

---

### 3. `FinJournalLine`
Represents debit and credit line items.

- `id`: String (UUID, PK)
- `journalEntryId`: String (FK -> `FinJournalEntry`)
- `accountId`: String (FK -> `FinAccount`)
- `debit`: Decimal (Default `0.00`)
- `credit`: Decimal (Default `0.00`)
- `description`: String (Nullable)

---

### 4. `FinPeriod`
Manages fiscal period status and locking.

- `id`: String (UUID, PK)
- `organizationId`: String
- `periodName`: String (e.g., `2026-09`)
- `startDate`: DateTime
- `endDate`: DateTime
- `status`: `FinPeriodStatus` (`OPEN`, `CLOSED`, `LOCKED`)

---

### 5. `FinSequence`
Atomic gapless sequence generator for entry numbers and receipt numbers.

- `id`: String (UUID, PK)
- `organizationId`: String
- `key`: String (Unique per org, e.g. `JE_SEQUENCE_202609`)
- `value`: Int (Default `0`)
