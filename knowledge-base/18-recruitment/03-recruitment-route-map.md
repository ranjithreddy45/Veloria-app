# 03 Recruitment Route Map

`CODE VERIFIED`

## Admin / Dashboard Routes
- `/recruitment`: ATS Dashboard & Pipeline Analytics matrix (`src/app/(dashboard)/recruitment/page.tsx`)
- `/recruitment/jobs`: Job Openings Management (`src/app/(dashboard)/recruitment/jobs/page.tsx`)
- `/recruitment/jobs/[id]`: Job Opening Detail & Linked Applications (`src/app/(dashboard)/recruitment/jobs/[id]/page.tsx`)
- `/recruitment/candidates`: Candidate Master Table (`src/app/(dashboard)/recruitment/candidates/page.tsx`)
- `/recruitment/candidates/[id]`: Candidate Profile, Timeline & Activity (`src/app/(dashboard)/recruitment/candidates/[id]/page.tsx`)
- `/recruitment/applications`: All Applications Kanban / Table (`src/app/(dashboard)/recruitment/applications/page.tsx`)
- `/recruitment/offers`: Master Offers Table (`src/app/(dashboard)/recruitment/offers/page.tsx`)
- `/recruitment/offers/[id]/letter`: Branded HTML Offer Letter Print Preview (`src/app/(dashboard)/recruitment/offers/[id]/letter/page.tsx`)
- `/recruitment/bgv`: Background Verification Workspace (`src/app/(dashboard)/recruitment/bgv/page.tsx`)

## Public Unauthenticated Routes
- `/careers`: Public Job Board (`src/app/careers/page.tsx`)
- `/careers/[id]`: Public Job Detail & Application Form (`src/app/careers/[id]/page.tsx`)
