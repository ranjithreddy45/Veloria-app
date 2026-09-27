# Phase 02: Header / Topbar Architecture

## 1. AppHeader Component (`src/components/layout/app-header.tsx`)

| Action ID | Header Action Element | Component File | Click Behavior / Purpose | Destination |
|---|---|---|---|---|
| HEADER-ACTION-0001 | Sidebar Trigger | `SidebarTrigger` | Toggles sidebar collapse/expand | Sidebar State |
| HEADER-ACTION-0002 | Breadcrumbs | `Breadcrumb` | Route path breadcrumb links | Parent Route |
| HEADER-ACTION-0003 | Venue Switcher | `VenueSwitcher` | Switches active property venue | Active Venue Context |
| HEADER-ACTION-0004 | Command Palette Trigger | `Button` (`Cmd+K`) | Opens command palette dialog | `CommandPalette` Dialog |
| HEADER-ACTION-0005 | Active Alerts Popup | `ActiveAlertsPopup` | Opens system alerts popover | Alerts List |
| HEADER-ACTION-0006 | Pending Approvals Chip | `PendingApprovalsChip` | Displays pending manager approvals count | `/approvals` |
| HEADER-ACTION-0007 | Velos Points Chip | `VelosChip` | Displays employee reward points | `/performance/velos` |
| HEADER-ACTION-0008 | Notification Bell | `NotificationPopover` | Opens notification panel | Notifications List |
| HEADER-ACTION-0009 | User Avatar Dropdown | `DropdownMenu` | Opens user account menu | Profile / Security / Sign Out |
