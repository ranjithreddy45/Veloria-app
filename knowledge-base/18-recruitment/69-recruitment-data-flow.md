# 69 Recruitment Data Flow

`CODE VERIFIED`

```
Public Applicant Input
  |
  +---> applyToRole()
           |
           +---> RecCandidate (email, phone, city, resumeUrl, source="Career site")
           +---> recordConsent() (DPDP Ledger)
           +---> RecApplication (stage="SCREENING")
                    |
                    v
          Internal ATS Review (/recruitment)
                    |
                    +---> RecInterview (scheduleInterview & setInterviewOutcome)
                    +---> RecBgvCheck (createBgvCheck & updateBgvCheck)
                    +---> RecOffer (createOffer & setOfferStatus)
                    |
                    v (Offer status = ACCEPTED)
          createEmployeeFromCandidate()
                    |
                    +---> Employee (status = ONBOARDING, notes = "Offered CTC...")
                    +---> startOnboarding()
```
