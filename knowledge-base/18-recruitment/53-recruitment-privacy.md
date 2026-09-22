# 53 Recruitment Privacy & DPDP Consent

`CODE VERIFIED`

- Public candidate submissions in `applyToRole()` invoke `recordConsent()` from `src/lib/privacy/consent.ts`.
- Logs DPDP privacy consent under subject type `CANDIDATE` with purpose `JOB_APPLICATION` and consent text `CONSENT_TEXT_CAREERS`.
