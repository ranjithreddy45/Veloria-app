# 43 Quality Assurance & Security Test Suite

`CODE VERIFIED`

## Test Matrix

| Test ID | Category | Scenario | Precondition | Expected Outcome | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TST-POR-01` | Security | Access `/portal` without session | No session cookie | Redirect to `/sign-in` | `CRITICAL` |
| `TST-POR-02` | IDOR | Client A requests Client B booking ID | Client A session active | Return `404 Not Found` or `403` | `CRITICAL` |
| `TST-POR-03` | Tokens | Access `/q/[token]` with expired token | `expiresAt` < Now | Display Token Expired error page | `HIGH` |
| `TST-POR-04` | Signature | Re-sign an already signed contract | `isLocked == true` | Block submission with error | `HIGH` |
| `TST-POR-05` | Payments | Razorpay webhook signature forgery | Invalid HMAC signature | Return `400 Bad Request` | `CRITICAL` |
