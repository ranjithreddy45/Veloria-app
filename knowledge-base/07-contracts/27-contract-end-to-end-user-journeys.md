# Contract End-to-End User Journeys

## Overview

Sequence diagrams illustrating end-to-end user navigation and execution flows for digital contract workflows.

---

## Journey 1: Contract Template Render to Public E-Sign Execution

```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Executive
    actor Client as Client
    participant App as Dashboard UI
    participant Action as Contract Action
    participant Public as Public Portal (/sign/[token])
    participant DB as Prisma PostgreSQL

    Sales->>App: Click "Generate Contract" from Quotation
    App->>Action: createContract() + Substitute Variables
    Action->>DB: INSERT INTO SignatureRequest (token: abc12)
    Sales->>Client: Send Link /sign/abc12
    Client->>Public: Open /sign/abc12
    Client->>Public: Draw Signature & Click Submit
    Public->>Action: submitSignature()
    Action->>DB: UPDATE SignatureRequest SET isLocked=true, status=SIGNED
    Action-->>Client: Render "Document Executed"
```
