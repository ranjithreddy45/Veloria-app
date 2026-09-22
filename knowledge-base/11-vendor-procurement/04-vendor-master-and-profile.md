# 04 - Vendor Master & Profile

---

## 📋 Vendor Model Fields (`prisma.vendor`)

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique vendor identifier |
| `name` | `String` | Required | Vendor display name |
| `company` | `String?` | Optional | Registered business name |
| `email` | `String?` | Optional | Contact email (used for portal login) |
| `phone` | `String?` | Optional | Contact phone number |
| `category` | `VendorCategory` | Required | Primary trade classification |
| `status` | `VendorStatus` | `@default(ACTIVE)` | `ACTIVE`, `INACTIVE`, `BLACKLISTED`, `PENDING_APPROVAL` |
| `address` | `String?` | Optional | Office / warehouse address |
| `gstin` | `String?` | Optional | 15-digit Tax GSTIN number |
| `rating` | `Float?` | Optional | Internal performance rating |
| `bankDetails` | `Json?` | Optional | Bank account name, number, IFSC code |
| `documents` | `Json?` | Optional | Compliance and tax document links |

---

## 🔒 Deduplication & Uniqueness Protection

`createVendor()` in `src/actions/vendor.actions.ts` enforces strict duplicate checks:
1. **Case-insensitive Name Check**: Prevents duplicate vendor names (`findFirst({ name: { equals: nameT, mode: "insensitive" } })`).
2. **Contact Key Deduplication**: Prevents duplicate phone numbers and emails using `coarseContactWhere()` and `matchesContactKey()`.
