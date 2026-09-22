# 01 Recruitment Subsystem Overview

`CODE VERIFIED`

## Architecture & Subsystem Boundaries

The Veloria Grand Recruitment & Hiring subsystem manages the complete applicant lifecycle from job opening posting, public application intake, screening, interview scheduling, background verification, offer letter generation, and automated handoff to Employee Central (`createEmployeeFromCandidate`).

```
+-----------------------------------------------------------------------------------+
|                              PUBLIC CAREERS PORTAL                                |
|                                   (/careers)                                      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             APPLICANT TRACKING SYSTEM                             |
|                        (/recruitment, /recruitment/candidates)                    |
|                                                                                   |
|  [RecJobOpening] ----> [RecApplication] <---- [RecCandidate]                      |
|                                                     |                             |
|                                                     +---> [RecInterview]          |
|                                                     +---> [RecBgvCheck]           |
|                                                     +---> [RecOffer]              |
+-----------------------------------------------------------------------------------+
                                         |
                                         | createEmployeeFromCandidate()
                                         v
+-----------------------------------------------------------------------------------+
|                              EMPLOYEE CENTRAL (HR)                                |
|                        (Employee: status = ONBOARDING)                            |
+-----------------------------------------------------------------------------------+
```

## Key Implemented Modules
1. **Job Openings**: `RecJobOpening` (`IN_PROGRESS`, `ON_HOLD`, `INACTIVE`, `FILLED`, `CANCELLED`).
2. **Candidates**: `RecCandidate` (`NEW`, `IN_REVIEW`, `AVAILABLE`, `ENGAGED`, `OFFERED`, `HIRED`, `REJECTED`).
3. **Job Applications**: `RecApplication` (`SCREENING`, `SUBMISSIONS`, `INTERVIEW`, `OFFERED`, `HIRED`, `REJECTED`, `ARCHIVED`).
4. **Interviews**: `RecInterview` (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`).
5. **Offer Letters**: `RecOffer` (`DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`).
6. **Background Verification**: `RecBgvCheck` (`PENDING`, `IN_PROGRESS`, `CLEARED`, `FLAGGED`, `FAILED`).
7. **Public Careers Portal**: `/careers` and `/careers/[id]` for unauthenticated public applications.
