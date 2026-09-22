# Module 18: Recruitment & Hiring

`CODE VERIFIED`

## Module Purpose
The Recruitment & Hiring module manages the entire talent acquisition lifecycle for Veloria Grand—from job openings and public careers portal applications (`/careers`), applicant tracking, screening, interview scheduling, background verification, offer letter generation, through to automated candidate-to-employee hiring conversion (`createEmployeeFromCandidate`).

---

## Technical & Architecture Summary

### Routes Discovered
- `/recruitment` — ATS Dashboard & Hiring Pipeline Matrix
- `/recruitment/jobs` — Job Openings Management
- `/recruitment/jobs/[id]` — Job Opening Detail & Linked Applications
- `/recruitment/candidates` — Candidate Directory
- `/recruitment/candidates/[id]` — Candidate Profile, Interviews & Offers
- `/recruitment/applications` — All Applications Kanban / Table
- `/recruitment/offers` — Offers Directory
- `/recruitment/offers/[id]/letter` — Branded HTML Offer Letter Print Preview
- `/recruitment/bgv` — Background Verification Workspace
- `/careers` — Public Unauthenticated Job Board
- `/careers/[id]` — Public Job Detail & Application Form

### Server Actions Discovered
- `src/actions/recruit.actions.ts`: `getRecruitDashboard`, `getJobOpenings`, `getJobOpeningDetail`, `createJobOpening`, `updateJobOpening`, `getCandidates`, `createCandidate`, `updateCandidateStage`.
- `src/actions/recruit-candidate.actions.ts`: `getCandidateDetail`, `scheduleInterview`, `setInterviewOutcome`, `createOffer`, `setOfferStatus`, `updateCandidateNotes`.
- `src/actions/recruit-hire.actions.ts`: `createEmployeeFromCandidate`.
- `src/actions/recruit-bgv.actions.ts`: `listBgvChecks`, `listBgvCandidates`, `createBgvCheck`, `updateBgvCheck`.
- `src/actions/recruit-offer-letter.actions.ts`: `listOffers`, `listOfferTemplates`, `getOfferLetter`.
- `src/actions/recruit-public.actions.ts`: `getOpenRoles`, `getOpenRole`, `applyToRole`.

### Prisma Models Discovered
- `RecJobOpening`
- `RecCandidate`
- `RecApplication`
- `RecInterview`
- `RecOffer`
- `RecBgvCheck`

### Downstream Handoff Summary (`createEmployeeFromCandidate`)
- `Candidate` -> `Employee` (`status: ONBOARDING`): `AUTOMATIC`
- `Candidate Email/Phone` -> `Employee.workEmail/phone`: `AUTOMATIC`
- `Candidate Name` -> `Employee.firstName/lastName`: `AUTOMATIC`
- `Job Dept/Title` -> `Employee.departmentId/designationId`: `AUTOMATIC` (Name match)
- `Offer Joining Date` -> `Employee.dateOfJoining`: `AUTOMATIC`
- `Offer CTC` -> `Employee.notes` (Text info): `AUTOMATIC`
- `Start Onboarding` -> `startOnboarding()`: `AUTOMATIC`
- `User Account Creation`: `MANUAL`
- `Reporting Manager Assignment`: `MANUAL`
- `Salary Structure (HrSalaryStructure)`: `MANUAL`
- `Statutory Data (EmployeeStatutory)`: `MANUAL`

---

## Document Index
1. `01-recruitment-overview.md` — Recruitment Subsystem Overview
2. `02-recruitment-business-purpose.md` — Business Purpose & Objectives
3. `03-recruitment-route-map.md` — Complete Route Navigation Map
4. `04-recruitment-server-actions.md` — Server Actions Reference
5. `05-recruitment-api-map.md` — API & Webhook Endpoints
6. `06-recruitment-database-models.md` — Prisma Database Schemas
7. `07-recruitment-enums.md` — Status & Stage Enums
8. `08-workforce-need.md` — Workforce Need & Planning
9. `09-job-requisition.md` — Job Requisition Integration
10. `10-requisition-approval.md` — Requisition Approval Rules
11. `11-job-opening.md` — Job Opening Management
12. `12-job-opening-lifecycle.md` — Job Opening State Machine
13. `13-public-job-application.md` — Public Career Site & Intake
14. `14-candidate-record.md` — Candidate Master Record
15. `15-candidate-sources.md` — Sourcing Channels
16. `16-resume-document-storage.md` — Resume Storage & Security
17. `17-duplicate-candidates.md` — Deduplication Mechanisms
18. `18-job-application.md` — Job Application Management
19. `19-application-status.md` — Application Pipeline Stages
20. `20-recruitment-pipeline.md` — Pipeline Matrix & Metrics
21. `21-candidate-screening.md` — Screening Stage
22. `22-screening-criteria.md` — Evaluation Criteria
23. `23-interview.md` — Interview Management
24. `24-interview-rounds.md` — Interview Rounds
25. `25-interview-scheduling.md` — Scheduling & Modes
26. `26-interview-evaluation.md` — Evaluation & Outcomes
27. `27-interview-feedback.md` — Feedback Storage
28. `28-candidate-selection.md` — Shortlisting & Selection
29. `29-offer-generation.md` — Offer Letter Creation
30. `30-offer-approval.md` — Offer Approval Workflow
31. `31-offer-document.md` — HTML/PDF Letter Merging
32. `32-offer-delivery.md` — Delivery Channels
33. `33-offer-acceptance.md` — Candidate Offer Acceptance
34. `34-offer-expiry.md` — Expiry Rules
35. `35-offer-negotiation.md` — Negotiation Handling
36. `36-recruitment-employee-creation.md` — `createEmployeeFromCandidate()` Implementation
37. `37-employee-status-after-hiring.md` — Post-Hiring Employee Status
38. `38-user-account-handoff.md` — User Account Creation Rules
39. `39-department-assignment.md` — Department Handoff Mapping
40. `40-designation-assignment.md` — Designation Handoff Mapping
41. `41-reporting-manager-assignment.md` — Reporting Manager Handoff
42. `42-employment-type-handoff.md` — Employment Type Handoff
43. `43-date-of-joining-handoff.md` — Joining Date Handoff
44. `44-salary-structure-handoff.md` — Salary Structure Handoff
45. `45-statutory-data-handoff.md` — Statutory Data Handoff
46. `46-onboarding-handoff.md` — Onboarding Journey Initiation
47. `47-onboarding-template.md` — Onboarding Template Selection
48. `48-document-collection.md` — Post-Hiring Document Intake
49. `49-background-verification.md` — BGV Checks & Attachments
50. `50-recruitment-notifications.md` — Notification Infrastructure
51. `51-recruitment-crons.md` — Cron Automation Jobs
52. `52-recruitment-rbac.md` — RBAC & Permission Gates
53. `53-recruitment-privacy.md` — Privacy & DPDP Consent Logging
54. `54-recruitment-audit-trail.md` — Audit Trail & Lineage
55. `55-recruitment-reports.md` — Reports & Metrics
56. `56-recruitment-export.md` — Data Export Functionality
57. `57-candidate-rejection.md` — Candidate Rejection Workflow
58. `58-candidate-withdrawal.md` — Application Withdrawal
59. `59-job-opening-closure.md` — Job Opening Closure
60. `60-recruitment-analytics.md` — Time-to-Fill & Time-to-Hire Analytics
61. `61-recruitment-hr-payroll-chain.md` — Recruitment -> HR -> Payroll End-to-End Chain
62. `62-recruitment-handoff-matrix.md` — Handoff Data Destination Matrix
63. `63-brief-vs-code.md` — Product Brief vs Code Discrepancies
64. `64-recruitment-gaps.md` — Gap Analysis
65. `65-recruitment-manual-verification.md` — Manual Verification Protocol
66. `66-end-to-end-recruitment-journeys.md` — End-to-End User Journeys
67. `67-recruitment-dependency-map.md` — System Dependency Graph
68. `68-recruitment-state-machines.md` — State Machine Registers
69. `69-recruitment-data-flow.md` — Data Flow Diagrams
70. `70-recruitment-test-matrix.md` — Static Audit Test Matrix
71. `71-complete-recruitment-feature-index.md` — Complete Feature & Action Index

---

CHUNK 18 STATUS: COMPLETE
