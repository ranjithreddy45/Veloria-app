# 08 - Event Details & Configuration

---

## 📋 Core Event Attributes (`Booking` & `Event`)

- **Event Name**: Custom descriptor (e.g. "Ananya & Rohan Sangeet & Reception").
- **Event Type**: Categorical classification (e.g., `WEDDING`, `RECEPTION`, `CORPORATE_GALA`, `BIRTHDAY`, `ANNIVERSARY`, `CONFERENCE`).
- **Time Slot (`TimeSlot` Enum)**:
  - `MORNING` (Typically 08:00 AM - 03:00 PM)
  - `EVENING` (Typically 05:00 PM - 11:30 PM)
  - `FULL_DAY` (24-hour exclusive property hold)
- **Start / End Datetimes**: Exact timestamp boundaries (`eventStartAt`, `startTime`, `endTime`).
- **Special Requests**: Textual notes capturing custom dietary preferences, VIP guest requirements, stage setup specs, or noise restrictions (`Booking.specialRequests`).
