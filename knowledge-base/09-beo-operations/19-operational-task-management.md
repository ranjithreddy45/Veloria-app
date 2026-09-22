# 19 - Operational Task Management & SLA System

---

## 📋 SLA Task Management (`ExecutionTask`)

Execution tasks enforce strict Service Level Agreements (SLAs) for banquet setup:

```prisma
// CODE VERIFIED: prisma/schema.prisma
model ExecutionTask {
  id               String              @id @default(cuid())
  title            String
  category         TaskCategory        // DECOR | AV | CATERING | HOUSEKEEPING | GUEST_SEATING | etc.
  priority         TaskPriority        // LOW | MEDIUM | HIGH | URGENT
  status           ExecutionTaskStatus // NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETED | DELAYED
  estimatedMinutes Int
  slaStartBy       DateTime?
  slaFinishBy      DateTime?
  actualStart      DateTime?
  actualFinish     DateTime?
}
```

- **Task Proofs (`TaskProof`)**: Allows workers to upload content/photos verifying task completion.
- **Mandatory Checklists (`ExecutionChecklist`)**: Tasks can require explicit itemized checklists before status can move to `COMPLETED`.
