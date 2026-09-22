# 04 Recruitment Server Actions

`CODE VERIFIED`

## 1. `src/actions/recruit.actions.ts`
- `getRecruitDashboard()`: Returns pipeline matrix, time-to-fill avg/rows, time-to-hire avg/rows, and total counts.
- `getJobOpenings()`: Returns all job openings with application counts and resolved user names.
- `getJobOpeningDetail(id)`: Returns opening details and all candidate applications.
- `createJobOpening(input)`: Creates new `RecJobOpening`.
- `updateJobOpening(id, input)`: Updates job opening fields/status.
- `getCandidates()`: Returns master candidate list with stage filters.
- `createCandidate(input)`: Manual HR candidate creation.
- `updateCandidateStage(id, stage)`: Updates candidate stage enum.

## 2. `src/actions/recruit-candidate.actions.ts`
- `getCandidateDetail(id)`: Returns candidate, applications, interviews, offers, and job options.
- `scheduleInterview(input)`: Creates `RecInterview`.
- `setInterviewOutcome(id, input)`: Updates interview status, rating (0-5), and feedback.
- `createOffer(input)`: Creates `RecOffer` with CTC cap check (`MAX_CTC = 50,000,000`).
- `setOfferStatus(id, status)`: Enforces state transitions (`DRAFT` -> `SENT` -> `ACCEPTED`/`DECLINED`/`WITHDRAWN`).
- `updateCandidateNotes(id, notes)`: Updates candidate notes text.

## 3. `src/actions/recruit-hire.actions.ts`
- `createEmployeeFromCandidate(candidateId)`: Checks HIRED gate, resolves legal entity, department, designation, date of joining, splits name, creates `Employee` (status `ONBOARDING`), appends notes, and starts onboarding (`startOnboarding`).

## 4. `src/actions/recruit-bgv.actions.ts`
- `listBgvChecks(filter)`: Lists background checks with candidate names/emails.
- `listBgvCandidates()`: Lists candidate selection options for BGV.
- `createBgvCheck(input)`: Creates `RecBgvCheck`.
- `updateBgvCheck(id, input)`: Updates status, vendor, remarks, attachment, completed date.

## 5. `src/actions/recruit-offer-letter.actions.ts`
- `listOffers()`: Lists all offers with resolved candidate and job details.
- `listOfferTemplates()`: Lists active `HrDocumentTemplate` templates.
- `getOfferLetter(offerId, templateId?)`: Merges offer placeholders into template HTML for printing.

## 6. `src/actions/recruit-public.actions.ts`
- `getOpenRoles()`: Returns public list of `IN_PROGRESS` openings.
- `getOpenRole(id)`: Returns single `IN_PROGRESS` opening detail.
- `applyToRole(jobOpeningId, input)`: Unauthenticated applicant submission, creates candidate/application, records DPDP privacy consent (`recordConsent`).
