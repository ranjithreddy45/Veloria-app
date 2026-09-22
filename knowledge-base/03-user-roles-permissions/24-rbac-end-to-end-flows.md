# RBAC End-to-End Sequence Flows

## Overview

Mermaid sequence diagrams demonstrating end-to-end authorization flows across key system interactions.

---

## Flow 1: Internal User Authentication & Route Access

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant Middleware
    participant Auth as NextAuth (auth.ts)
    participant Page as Dashboard Page

    User->>Browser: Access /dashboard/sales
    Browser->>Middleware: GET Request with Session Cookie
    Middleware->>Auth: Validate JWT & User Role
    Auth-->>Middleware: Session Valid (Role: SALES_EXEC)
    Middleware->>Middleware: routePermission("/dashboard/sales") -> sales:read
    Middleware-->>Browser: Allow Access
    Browser->>Page: Render Sales Dashboard Component
```

---

## Flow 2: Server Action Authorization & DB Execution

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Form as React Form Component
    participant Action as Server Action (reimbursement.ts)
    participant Auth as NextAuth auth()
    participant DB as Prisma / PostgreSQL

    User->>Form: Submit Expense Claim
    Form->>Action: submitReimbursement(formData)
    Action->>Auth: auth()
    Auth-->>Action: session.user (id: 101, role: STAFF)
    Action->>Action: hasPermission("STAFF", "reimbursements:create")
    Action->>DB: INSERT INTO Reimbursement (employeeId: 101, status: PENDING)
    DB-->>Action: Record Created
    Action-->>Form: Return Success Response
```

---

## Flow 3: External Client Portal Isolation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Browser
    participant Middleware
    participant Action as Client Portal Action
    participant DB as Prisma DB

    Client->>Browser: Access /client/bookings
    Browser->>Middleware: Request /client/bookings
    Middleware->>Middleware: Verify Role === CLIENT
    Middleware-->>Browser: Allow
    Browser->>Action: getClientBookings()
    Action->>DB: SELECT * FROM Booking WHERE clientId = session.user.clientId
    DB-->>Action: Return Client-Scoped Records
    Action-->>Browser: Render Bookings List
```
