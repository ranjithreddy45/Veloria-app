# CHUNK 01-02 — TECHNOLOGY STACK

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/02-technology-stack.md`

---

## 📌 Verified Production Technology Stack

Below is the exhaustive, code-verified technology stack derived directly from `package.json`, `next.config.ts`, `prisma/schema.prisma`, and configuration manifests.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VELORIA TECHNOLOGY STACK                        │
├──────────────────────┬─────────────────────────────────────────────────┤
│ Core Framework       │ Next.js 16.1.6 (App Router, Server Actions)     │
│ UI Runtime           │ React 19.2.3, React DOM 19.2.3                  │
│ Language             │ TypeScript 5 (Strict Mode enabled)              │
│ Styling              │ Tailwind CSS v4 (@tailwindcss/postcss), clsx    │
│ Component Primitives │ Radix UI (1.4.3), Shadcn UI, cmdk, Lucide Icons │
│ Forms & Validation   │ React Hook Form 7.71.2, Zod 4.3.6, Resolvers    │
│ Data Fetching & State│ TanStack React Query 5.90.21, Zustand 5.0.11     │
│ Database & ORM       │ PostgreSQL, Prisma ORM 6.19.2 (@prisma/client)  │
│ Authentication       │ NextAuth 5.0.0-beta.30 (@auth/prisma-adapter)   │
│ Cryptography & OTP   │ bcryptjs 3.0.3, otplib 13.5.0, qrcode 1.5.4       │
│ File Storage         │ AWS S3 SDK 3.1132.0 (Direct Presigned Uploads)  │
│ Payments & Billing   │ Razorpay SDK 2.9.6                              │
│ Email Service        │ Resend SDK 6.9.2                                │
│ WhatsApp & Messaging │ Meta WhatsApp Cloud API (REST), web-push 3.6.7 │
│ AI Engine            │ OpenAI SDK 6.25.0 (GPT-4 Lead Scoring)          │
│ Exception Tracking   │ Sentry Next.js SDK 10.74.0                      │
│ Native Mobile Shell  │ Capacitor 8.1.0 (@capacitor/core, Android/iOS) │
│ Mobile Biometrics    │ @capgo/capacitor-native-biometric 8.4.2        │
│ Process Management   │ PM2 (ecosystem.config.js), Docker container     │
│ Testing Suite        │ Vitest 4.1.7, Playwright 1.63.0                 │
└──────────────────────┴─────────────────────────────────────────────────┘
```

---

## 🛠️ Detailed Stack Usage in Veloria Grand

### 1. Core Framework & UI Layer
- **Next.js 16.1.6**: Serves as the full-stack web framework utilizing the App Router framework. It leverages Server Components (RSC) for zero-bundle-size database data fetching and Server Actions (`"use server"`) for type-safe data mutations.
- **React 19.2.3**: Provides component-based rendering, support for React Server Actions, `useActionState`, and optimized DOM rendering.
- **Tailwind CSS v4 & PostCSS**: Custom utility-first styling system integrated with `@tailwindcss/postcss` and `tw-animate-css` for responsive dashboard layouts, glassmorphism, and dark/light mode themes via `next-themes`.

### 2. Forms, Validation & State Management
- **Zod 4.3.6**: Centralized schema validation library (`src/schemas/*`). Enforces strict type validation on all incoming Server Action arguments, API request payloads, and client forms.
- **React Hook Form 7.71.2 & `@hookform/resolvers`**: Manages complex client-side form state across multi-step quotation forms, BEO configurations, and HR employee onboarding sheets.
- **Zustand 5.0.11**: Lightweight client-side state store for global active venue selection, sidebar collapse states, and real-time chat modal states.
- **TanStack React Query 5.90.21**: Manages client-side asynchronous caching, background re-fetching, and optimistic UI updates.

### 3. Database & Authentication
- **Prisma ORM 6.19.2**: Provides type-safe database queries against PostgreSQL (`prisma/schema.prisma`). It handles relational schema migrations (`prisma migrate`), database seeding (`prisma/seed.ts`), and global query execution singleton (`src/lib/prisma.ts`).
- **NextAuth 5.0.0-beta.30**: Modular authentication system. Split into an Edge-compatible configuration (`auth.config.ts`) used by `middleware.ts` and a full Node.js execution engine (`auth.ts`) utilizing `@auth/prisma-adapter` and `bcryptjs`.

### 4. External Integrations & Storage
- **AWS S3 SDK 3.1132.0**: Uses `@aws-sdk/s3-request-presigner` to generate secure, time-limited presigned upload URLs. Clients upload receipts, signed contracts, and venue photos directly to S3 buckets (`src/lib/storage/s3.ts`).
- **Razorpay SDK 2.9.6**: Handles online payment link generation, order creation, HMAC signature verification, and automated ledger posting upon webhook callbacks (`src/lib/payments/razorpay-creds.ts`).
- **Resend SDK 6.9.2**: Transactional email dispatch service (`src/lib/email.ts`). Delivers quotation PDFs, booking confirmations, e-signature requests, and password reset links.
- **Meta WhatsApp Cloud API**: Direct REST API integration (`src/lib/integrations/whatsapp.ts`) sending automated event reminders, lead assignment notifications, and customer nudges.
- **OpenAI SDK 6.25.0**: Calls GPT-4 endpoints (`src/actions/ai.actions.ts`) to compute AI lead conversion quality scores and extract sentiment from customer survey feedback.

### 5. Mobile Runtime & Production Tooling
- **Capacitor 8.1.0**: Native bridge packaging the Next.js web build into iOS (`ios/`) and Android (`android/`) applications (`capacitor.config.ts`).
- **@capgo/capacitor-native-biometric 8.4.2**: Provides Touch ID / Face ID / Android Biometric authentication for native app login.
- **Sentry 10.74.0**: Captures unhandled client and server errors across Edge, Server, and Client runtimes (`sentry.server.config.ts`).
- **PM2 & Docker**: Manages production process lifecycle (`ecosystem.config.js`) and containerized deployments (`Dockerfile`, `docker-compose.yml`).
