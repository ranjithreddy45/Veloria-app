# LEAD FOLLOW-UPS & TASKS FORENSICS

## 1. Task Scheduling (`ScheduleTaskDialog`)

Implemented in [schedule-task-dialog.tsx](file:///Users/fci/Documents/Veloria-app/src/components/crm/schedule-task-dialog.tsx).

- **Task Types**: Call, WhatsApp, Email, Meeting, Custom.
- **Due Date & Time**: Date picker with time slot selector.
- **Server Action**: `createCrmTask()`
- **Work Strip Integration**: Overdue tasks increment the urgency counter on `/leads` `WorkStrip`.
