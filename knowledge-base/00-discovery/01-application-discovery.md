# VELORIA GRAND — APPLICATION OVERVIEW & ARCHITECTURE DISCOVERY

---

## 📌 Application Discovery Summary

- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Application Name**: Veloria Grand Platform
- **Repository Root**: `/Users/fci/Documents/Veloria-app`
- **Framework & Engine**: Next.js 16.1.6 (App Router, Server Actions)
- **UI & Styling**: React 19.2.3, Tailwind CSS v4, Lucide Icons, Shadcn UI
- **Database & ORM**: PostgreSQL with Prisma ORM 6.19.2
- **Auth System**: NextAuth v5 (`5.0.0-beta.30`) with Edge-compatible auth config
- **Mobile Runtime**: Capacitor 8.1.0 (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`)

---

## 📊 High-Level Metrics Summary

| Component | Codebase Count |
|---|---|
| **App Route Endpoints** | **593 Pages & API Routes** (`src/app/`) |
| **Server Action Files** | **325 Files** (`src/actions/`) |
| **Exported Server Action Functions** | **1,799 Functions** |
| **Prisma Models** | **361 Models** (`prisma/schema.prisma`) |
| **Prisma Enums** | **166 Enums** (`prisma/schema.prisma`) |
| **Implemented User Roles** | **23 User Roles** (`UserRole` Enum) |
| **Cron Jobs / Automations** | **56 Active Cron Routes** (`src/app/api/cron/`) |
| **Webhook Endpoints** | **7 Active Webhook Routes** (`src/app/api/webhooks/`, `src/app/api/payments/`) |
| **External Integrations** | **9 External Services** |

---

## 📂 Repository Layout Map

```
src/
├── app/                    # 1,441 files total (593 page & route endpoints)
│   ├── (auth)/             # Auth routes: sign-in, sign-up, two-factor, reset-password
│   ├── (dashboard)/        # Internal Staff CRM & Operations Portal (395 routes)
│   ├── (portal)/           # Client Portal (17 routes)
│   ├── (vendor-portal)/    # Vendor Portal (4 routes)
│   ├── (guest)/            # Guest RSVP & App Portal (28 routes)
│   ├── (public)/           # Public e-signatures, quote views, holds, RSVPs (21 routes)
│   ├── (print)/            # Print-formatted invoice layouts
│   ├── api/                # API Endpoints (111 routes: 56 Cron, 7 Webhooks, 48 REST APIs)
│   ├── pay/                # Public Razorpay payment checkout
│   ├── onboard/            # Self-serve onboarding forms
│   └── widget/             # Embeddable website lead inquiry widget
├── actions/                # 325 Server Action files (1,799 exported functions)
├── components/             # 122 React UI component files
├── lib/                    # 431 core logic & domain utility files
│   ├── permissions.ts      # Role-Based Access Control (RBAC) & Route permissions
│   ├── db.ts               # Global Prisma client singleton (`prisma`)
│   ├── auth.ts / auth.config.ts # NextAuth v5 configuration
│   ├── s3.ts               # AWS S3 direct presigned URL helpers
│   ├── razorpay.ts         # Razorpay SDK & webhook signature verification
│   ├── resend.ts           # Resend email notification service
│   ├── whatsapp.ts         # Meta Cloud API WhatsApp messaging
│   └── blueprints/         # Event execution blueprint generator engine
├── schemas/                # 87 Zod validation schemas
├── hooks/                  # Client-side React hooks
└── types/                  # TypeScript definitions
```
