# 06 Employment Information & Parameters

## Employment Fields (`Employee` Model)

- `employmentType`: Enum (`FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`).
- `dateOfJoining`: Mandatory joining date.
- `dateOfExit`: Nullable exit date recorded upon termination or resignation.
- `workLocation`: General location / venue label.
- `siteIds`: Array of authorized `AttendanceSite` IDs for geofenced punching.
