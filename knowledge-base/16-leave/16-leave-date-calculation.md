# 16 Leave Duration & Date Math

## Working Day Calculation

When counting leave days between `startDate` and `endDate`, the system iterates each UTC date and skips weekends (Saturday/Sunday) and matches in `Holiday` table. Half-day start/end parameters adjust the total by 0.5.
