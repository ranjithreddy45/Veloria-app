# 08 Geofencing & Location Verification

## Verification Math

The server calculates Haversine distance between employee device coordinates (`checkInLat`, `checkInLng`) and `AttendanceSite` coordinates (`lat`, `lng`). If distance is within `radiusMeters` and `checkInAccuracyM` is acceptable, `locationVerified = true`.
