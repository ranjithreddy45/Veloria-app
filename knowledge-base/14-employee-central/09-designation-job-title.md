# 09 Designation & Job Title Master

## Designation Schema (`HrDesignation`)

```prisma
model HrDesignation {
  id        String     @id @default(cuid())
  name      String
  isActive  Boolean    @default(true)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt
  employees Employee[]
}
```

Designations define job roles (e.g. Banquet Manager, Executive Chef, Event Co-ordinator). Managed via `src/actions/hr-config.actions.ts`.
