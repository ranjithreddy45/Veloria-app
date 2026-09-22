# 13 Public Job Application

`CODE VERIFIED`

- Public job board at `/careers` lists active roles (`getOpenRoles`).
- Candidate applies via `/careers/[id]` using `applyToRole()`.
- Captures `firstName`, `lastName`, `email`, `phone`, `city`, `resumeUrl`, and DPDP `consent`.
- Automatically calls `recordConsent` (`JOB_APPLICATION` purpose).
