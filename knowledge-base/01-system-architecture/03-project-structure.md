# CHUNK 01-03 — PROJECT STRUCTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/03-project-structure.md`

---

## 📌 Repository File Tree Map

Below is the repository directory structure for Veloria Grand:

```
/Users/fci/Documents/Veloria-app/
├── src/
│   ├── app/                    # 1,441 files (593 route endpoints)
│   │   ├── (auth)/             # Authentication route group (sign-in, sign-up, 2FA)
│   │   ├── (dashboard)/        # Internal Staff CRM & Operations Portal (395 routes)
│   │   ├── (portal)/           # Client Portal (17 routes)
│   │   ├── (vendor-portal)/    # Vendor Portal (4 routes)
│   │   ├── (guest)/            # Guest RSVP & App Portal (28 routes)
│   │   ├── (public)/           # Public tokenized viewers (quotes, sign, hold) (21 routes)
│   │   ├── (print)/            # Print-formatted invoice layouts
│   │   ├── api/                # API Endpoints (111 routes: 56 Cron, 7 Webhooks)
│   │   ├── pay/                # Public Razorpay payment checkout
│   │   ├── onboard/            # Self-serve onboarding forms
│   │   ├── widget/             # Embeddable website lead inquiry widget
│   │   ├── layout.tsx          # Root Application Layout & Global Providers
│   │   └── page.tsx            # Public Landing Page
│   ├── actions/                # 325 Server Action files (1,799 exported functions)
│   ├── components/             # 122 React UI Component files (Shadcn UI, domain views)
│   ├── lib/                    # 431 core logic & domain utility files
│   │   ├── permissions.ts      # RBAC permission matrix & route mappings
│   │   ├── prisma.ts           # Prisma ORM singleton client
│   │   ├── email.ts            # Resend transactional email helper
│   │   ├── telephony.ts        # Runo call synchronization logic
│   │   ├── blueprints/         # Blueprint execution task engine
│   │   ├── storage/            # S3 presigned URL storage helper (`src/lib/storage/s3.ts`)
│   │   ├── integrations/       # WhatsApp Cloud API integration (`src/lib/integrations/whatsapp.ts`)
│   │   └── payments/           # Razorpay SDK credentials helper (`src/lib/payments/razorpay-creds.ts`)
│   ├── schemas/                # 87 Zod validation schemas
│   ├── hooks/                  # Custom client-side React hooks
│   └── types/                  # Shared TypeScript interface definitions
├── prisma/
│   ├── schema.prisma           # Complete database schema (361 Models, 166 Enums)
│   ├── migrations/             # Migration history
│   └── seed.ts                 # Master seed file
├── public/                     # Static assets, brand logos, PDF templates
├── knowledge-base/             # Permanent Standalone Application Knowledge Base
├── capacitor.config.ts         # Mobile App configuration (iOS/Android)
├── middleware.ts               # Edge Middleware for session check & RBAC
├── auth.ts / auth.config.ts    # NextAuth v5 configuration
├── next.config.ts              # Next.js build & security header configuration
├── Dockerfile                  # Production Docker image build
├── docker-compose.yml          # Container orchestration manifest
├── ecosystem.config.js         # PM2 production process configuration
├── deploy.sh                   # VPS deployment bash script
├── package.json                # Project dependencies & script entries
└── tsconfig.json               # TypeScript configuration with `@/*` path alias
```

---

## 🏢 Directory Responsibilities & Enforcement Rules

| Directory | Responsibility / Scope | Strictly Prohibited Contents | Key Examples |
|---|---|---|---|
| `src/app/` | Page components, route handlers, layouts, route groups | Direct DB queries inside Client Components | `src/app/(dashboard)/leads/page.tsx` |
| `src/actions/` | Type-safe Server Actions (`"use server"`). Data mutations & RBAC assertions | DOM manipulation, React hooks (`useState`) | `src/actions/hr-reimbursement.actions.ts` |
| `src/components/` | Reusable React UI components, Shadcn primitives, dialogs | Raw Prisma database queries | `src/components/ui/button.tsx` |
| `src/lib/` | Core domain business logic, third-party SDK helpers, singleton instances | JSX/TSX component markup | `src/lib/permissions.ts`, `src/lib/prisma.ts` |
| `src/schemas/` | Zod validation schemas for input sanitization | Database mutations or network calls | `src/schemas/hr.schema.ts` |
| `prisma/` | Database model definitions, migrations, seed data | Frontend UI code | `prisma/schema.prisma` |
