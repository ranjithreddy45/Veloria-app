# INVITATION & ACCOUNT ACTIVATION FORENSICS

## 1. Client & Staff Invitation Architecture

Invitations allow new clients or staff to onboard without public self-registration.

```
STAFF GENERATES INVITE ──► INVITE TOKEN CREATED ──► INVITE LINK SENT TO USER ──► ACCESS PORTAL
```

---

## 2. Client Portal Invitations

- **Action Handler**: `generatePortalInvite` in [customer-access.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/customer-access.actions.ts).
- **Token Generation**: Creates a unique access token linked to the customer booking record.
- **URL Format**: `/portal?token=INVITE_TOKEN_HERE` or `/q/[token]`.
- **Activation Experience**:
  1. Customer opens the tokenized link.
  2. Customer sets up account credentials or logs into existing portal session.
  3. Customer accesses their specific event booking portal.
