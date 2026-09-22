# 71 Complete Recruitment Feature Index

`CODE VERIFIED`

| Feature | Route | Server Action / Component | Models Used | RBAC Permission | Status |
|---|---|---|---|---|---|
| ATS Dashboard | `/recruitment` | `getRecruitDashboard()` | `RecJobOpening`, `RecApplication`, `RecCandidate` | `recruit:read` | `IMPLEMENTED` |
| Job Openings | `/recruitment/jobs` | `getJobOpenings()`, `createJobOpening()` | `RecJobOpening` | `recruit:read` / `write` | `IMPLEMENTED` |
| Candidate Directory | `/recruitment/candidates` | `getCandidates()`, `createCandidate()` | `RecCandidate` | `recruit:read` / `write` | `IMPLEMENTED` |
| Candidate Profile | `/recruitment/candidates/[id]` | `getCandidateDetail()` | `RecCandidate`, `RecApplication`, `RecInterview`, `RecOffer` | `recruit:read` | `IMPLEMENTED` |
| Schedule Interview | `/recruitment/candidates/[id]` | `scheduleInterview()` | `RecInterview` | `recruit:write` | `IMPLEMENTED` |
| Interview Outcome | `/recruitment/candidates/[id]` | `setInterviewOutcome()` | `RecInterview` | `recruit:write` | `IMPLEMENTED` |
| Create Offer | `/recruitment/candidates/[id]` | `createOffer()` | `RecOffer` | `recruit:write` | `IMPLEMENTED` |
| Offer Status | `/recruitment/candidates/[id]` | `setOfferStatus()` | `RecOffer` | `recruit:write` | `IMPLEMENTED` |
| Offer Letter Print | `/recruitment/offers/[id]/letter` | `getOfferLetter()` | `RecOffer`, `HrDocumentTemplate` | `recruit:read` | `IMPLEMENTED` |
| BGV Workspace | `/recruitment/bgv` | `listBgvChecks()`, `createBgvCheck()`, `updateBgvCheck()` | `RecBgvCheck`, `RecCandidate` | `recruit:read` / `write` | `IMPLEMENTED` |
| Convert to Employee | `/recruitment/candidates/[id]` | `createEmployeeFromCandidate()` | `RecCandidate`, `RecOffer`, `Employee` | `hr:write` / `hr:admin` | `IMPLEMENTED` |
| Public Careers Board | `/careers` | `getOpenRoles()` | `RecJobOpening` | Public | `IMPLEMENTED` |
| Public Job Apply | `/careers/[id]` | `applyToRole()` | `RecJobOpening`, `RecCandidate`, `RecApplication`, `PrivacyConsentLedger` | Public | `IMPLEMENTED` |
