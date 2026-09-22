# 16 Resume Document Storage

`CODE VERIFIED`

- Resumes stored in `RecCandidate.resumeUrl`.
- Validated via `validateResumeUrl()`: accepts HTTPS URL or Base64 Data URL (PDF/Image) up to 1.6 MB (`RESUME_MAX_LEN = 2,200,000`).
