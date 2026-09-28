# LEAD CONVERSION FORENSICS

## 1. Conversion Workflow

```
QUALIFIED LEAD ──► CLICK "CONVERT TO CUSTOMER" ──► EXECUTE convertLeadToCustomer() ──► CREATE CUSTOMER & BOOKING ──► REDIRECT TO /bookings/[id]
```

- **Validation**: Lead must have phone and name verified.
- **Database Result**: Creates `Customer` entity, locks lead record, marks status as `WON`.
