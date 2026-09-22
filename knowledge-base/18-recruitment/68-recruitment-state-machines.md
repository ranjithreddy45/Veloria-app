# 68 Recruitment State Machine Register

`CODE VERIFIED`

- **Offer Status State Machine**:
  - `DRAFT` -> `SENT`, `WITHDRAWN`
  - `SENT` -> `ACCEPTED`, `DECLINED`, `WITHDRAWN`
  - `ACCEPTED` -> Terminal (No further transitions)
  - `DECLINED` -> Terminal
  - `WITHDRAWN` -> Terminal

- **Job Opening Status State Machine**:
  - `IN_PROGRESS` -> `ON_HOLD`, `INACTIVE`, `FILLED`, `CANCELLED`

- **BGV Status State Machine**:
  - `PENDING` -> `IN_PROGRESS` -> `CLEARED` / `FLAGGED` / `FAILED` (Terminal: stamps `completedAt = now()`)
