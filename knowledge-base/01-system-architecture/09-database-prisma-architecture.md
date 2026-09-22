# CHUNK 01-09 — DATABASE / PRISMA ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/09-database-prisma-architecture.md`

---

## 📌 Database Overview & Prisma Client Architecture

Veloria Grand connects to a **PostgreSQL** relational database managed via **Prisma ORM 6.19.2**.

- **Schema File**: `prisma/schema.prisma`
- **Models**: **361 Models**
- **Enums**: **166 Enums**
- **Prisma Client Singleton**: `src/lib/prisma.ts`

### Singleton Pattern (`src/lib/prisma.ts`)

To prevent PostgreSQL connection pool exhaustion during Next.js Hot Module Replacement (HMR) in development, the Prisma Client is instantiated as a global singleton:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## 🔄 Transaction & Query Conventions

1. **Multi-Model Transactions**: Executed via `prisma.$transaction([ ... ])` to ensure ACID compliance during complex operations like booking creation or payroll processing.
2. **Soft Deletes**: Key operational models utilize soft deletion (`deletedAt: DateTime?`) rather than hard deletion to preserve financial audit trails.
3. **Pagination**: Large tabular views (`src/app/(dashboard)/leads`) enforce cursor-based or `skip`/`take` pagination with a default page size of 25.
