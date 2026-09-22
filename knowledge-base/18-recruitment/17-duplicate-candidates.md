# 17 Duplicate Candidates

`CODE VERIFIED`

- Candidates deduplicated by `email` during public apply (`applyToRole`). Reuses existing candidate record if email matches.
- Applications deduplicated by `@@unique([candidateId, jobOpeningId])` on `RecApplication`.
