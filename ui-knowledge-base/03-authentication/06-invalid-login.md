# INVALID LOGIN & FAILURE HANDLING

## 1. Failure Scenario Inventory

The authentication UI handles 6 explicit failure vectors.

```
USER ACTION ──► FAILURE DETECTED ──► UI ERROR RESPONSE ──► RECOVERY ACTION
```

---

## 2. Failure Vector Matrix

| Failure Vector | Trigger Condition | UI Error Response | Recovery Action |
|---|---|---|---|
| **Invalid Credentials** | Incorrect email or password entered | Red toast notification: `"Invalid email or password"` | User re-enters credentials |
| **Missing Fields** | Form submitted with empty email or password | Field validation message below input: `"Email is required"` or `"Password is required"` | User fills required input |
| **Malformed Email** | Email lacking `@` or domain | Field validation error: `"Enter your full email address..."` | User corrects email format |
| **User Not Found** | Email does not exist in Prisma database | Standard generic message: `"Invalid email or password"` (prevents account enumeration) | User checks email or registers |
| **Disabled Account** | User record marked `isActive: false` | Toast notification: `"Your account has been deactivated. Please contact support."` | User contacts administrator |
| **Network / Server Error** | Unexpected server or database exception | Toast notification: `"An unexpected error occurred. Please try again."` | User retries submission |

---

## 3. Account Enumeration Prevention

- **Security Behavior**: The system uses generic error messages (`"Invalid email or password"`) for both non-existent emails and wrong passwords.
- **Source Proof**: In [auth.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/auth.actions.ts), both user lookup failures and bcrypt comparison failures return identical error structures:
```typescript
if (!user || !(await bcryptjs.compare(password, user.password))) {
  return { success: false, error: "Invalid email or password" };
}
```
