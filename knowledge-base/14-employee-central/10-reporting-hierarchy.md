# 10 Reporting Hierarchy & Org Chart Engine

## Self-Referential Reporting Relation

```prisma
reportingManagerId String?
reportingManager   Employee?  @relation("EmployeeReports", fields: [reportingManagerId], references: [id])
reports            Employee[] @relation("EmployeeReports")
```

---

## Org Tree Function (`getOrgTree` in `src/actions/hr-employee.actions.ts`)

Fetches root employees (`reportingManagerId == null`) and recursively populates child `reports` arrays to build the interactive organizational chart rendered on `/people/org`.
