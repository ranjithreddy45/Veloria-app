# 05 Campaign Management

`CODE VERIFIED`

Veloria Grand implements a two-tier campaign management architecture:

### 1. Multi-Channel Performance Campaigns (`MarketingCampaign`)
- **Purpose**: Track advertising spend across Facebook Ads, Google Ads, WedMeGood, and offline channels to compute CAC and ROAS.
- **Attributes**: `channel`, `utmSource`, `utmMedium`, `utmCampaign`, `spendToDate` (Decimal), `currency` (INR).
- **Location**: Managed at `/marketing/campaigns`.

### 2. Email Marketing Campaigns (`Campaign`)
- **Purpose**: Execute broadcast email blasts to customer segments.
- **Attributes**: `subject`, `htmlContent`, `recipientFilter` (JSON), `totalSent`, `totalOpened`, `totalClicked`.
- **Location**: Managed at `/campaigns`.
