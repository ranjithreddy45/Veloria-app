# 08 Department Master Implementation

## Department Schema (`Department`)

```prisma
model Department {
  id        String     @id @default(cuid())
  name      String
  isActive  Boolean    @default(true)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt
  employees Employee[]
}
```

Departments organize employees into operational units (e.g., Banquets, Kitchen, Housekeeping, Sales, Finance, HR). Managed via Server Actions in `src/actions/hr-config.actions.ts`.
