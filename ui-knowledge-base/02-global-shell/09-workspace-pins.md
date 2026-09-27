# Phase 02: Workspace Pins System

## 1. Workspace Pins Engine (`src/lib/workspace/pins.ts`)
- Allows users to pin up to 6 (`MAX_PINS = 6`) favorite navigation shortcuts.
- Persisted in client `localStorage` under key `workspace:pins:v1`.
- Rendered in a dedicated quick-access bar near the top of the sidebar.
