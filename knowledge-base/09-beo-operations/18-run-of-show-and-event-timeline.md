# 18 - Run of Show & Event Timeline

---

## ⏱️ Timeline Architecture (`EventDayTimeline` & `TimelineItem`)

```prisma
// CODE VERIFIED: prisma/schema.prisma
model TimelineItem {
  id          String             @id @default(cuid())
  time        String             // e.g. "19:30"
  activity    String             // e.g. "Cake Cutting Ceremony"
  status      TimelineItemStatus @default(PENDING) // PENDING | IN_PROGRESS | DONE | SKIPPED
  completedAt DateTime?
  notes       String?
  order       Int                @default(0)
}
```

- **Server Actions**: `src/actions/event-day.actions.ts` (`addTimelineItem`, `updateItemStatus`, `reorderItems`).
- **Order Management**: Items support drag-and-drop reordering via explicit `order` index integers.
