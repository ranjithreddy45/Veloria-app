# 13 Employee Onboarding Workflow

## Onboarding Engine (`hr-journey.actions.ts`)

- Initiated when employee is created with status `ONBOARDING`.
- Generates onboarding task template checklist (`OnboardingTaskTemplate`).
- Collects required documents (`HrRequiredDocType`).
- Updates status to `ACTIVE` upon HR sign-off.
