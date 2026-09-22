# 07 Attendance Site & Location Configuration

## AttendanceSite Model

```prisma
model AttendanceSite {
  id            String   @id @default(cuid())
  name          String
  legalEntityId String?
  lat           Float?
  lng           Float?
  radiusMeters  Int      @default(200)
  allowedIps    String?
  allowWfh      Boolean  @default(true)
  isActive      Boolean  @default(true)
}
```

Defines physical geofence boundaries for venue check-ins.
