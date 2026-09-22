# 38 - BEO & Operations User Journeys

---

## 🛤️ Supported Operational Journeys

### Journey A: Operations Manager Creates & Publishes BEO Function Sheet
```
Ops Manager views Confirmed Booking (/bookings/[bookingId])
  -> Clicks "Create BEO"
  -> Action `createBeo` mints BEO record (status = DRAFT, covers = contracted)
  -> Ops Manager builds run-of-show timeline & specifies hall seating
  -> Ops Manager clicks "Publish BEO" (`setBeoStatus('PUBLISHED')`)
  -> System dispatches WhatsApp notification to Head Chef & Event Coordinator
```

### Journey B: Event Coordinator Executes Event Day & Handles Incidents
```
Event Coordinator opens Day-Of Control (/bookings/[bookingId]/control & /day-of)
  -> Monitors live timeline & updates activity status to DONE
  -> Medical emergency occurs -> Launcher calls `reportIncident()` (src/actions/emergency.actions.ts)
  -> System dispatches emergency notifications to Ops Head & venue security
  -> Incident resolved & post-event sign-off executed
```
