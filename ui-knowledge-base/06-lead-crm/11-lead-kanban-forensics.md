# LEAD KANBAN / BOARD FORENSICS

## 1. Board Specifications (`BOARD-0601`)

The Lead Kanban view is accessible via the view switcher on `/leads` (`?view=kanban`).

- **Board ID**: `BOARD-0601`
- **Columns**: 6 columns mapping to Lead Statuses (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_SENT`, `WON`, `LOST`).
- **Cards**: Displays Lead Name, Event Date, Budget, Guest Count, and Assigned Rep Avatar.
- **Drag-and-Drop Action**: Dragging a card between columns triggers an optimistic UI update and executes `updateLeadStatus()`.
