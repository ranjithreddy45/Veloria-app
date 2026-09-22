# 03 Data Model Inventory

`SCHEMA VERIFIED`

## Marketing-Owned Models
1. `MarketingCampaign`: Closed-loop multi-channel spend ledger (`name`, `channel`, `utmSource`, `utmMedium`, `utmCampaign`, `spendToDate`, `currency`, `startDate`, `endDate`, `isActive`, `notes`).
2. `LeadAttribution`: First-touch UTM and click ID snapshot (`source`, `medium`, `campaign`, `term`, `content`, `utmSource`, `utmMedium`, `utmCampaign`, `referrerUrl`, `landingUrl`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `clientId`, `gadsCampaignId`, `gadsAdgroupId`, `gadsCreativeId`, `gadsKeyword`, `gadsMatchType`, `gadsNetwork`, `gadsDevice`, `bookedRevenue`, `leadId`, `campaignId`). 1:1 linked with `Lead`.
3. `Campaign`: Email broadcast campaign (`name`, `subject`, `htmlContent`, `status`, `scheduledAt`, `sentAt`, `recipientFilter`, `totalSent`, `totalOpened`, `totalClicked`).
4. `EmailTemplate`: Reusable HTML email templates (`name`, `subject`, `htmlContent`, `category`, `isActive`).
5. `EmailTrackingPixel` & `EmailTrackingEvent`: Track email opens and link clicks.
6. `ReferralPartner`, `ReferralPortalSubmission`, `ReferralPayout`: Client and B2B partner referral program.
7. `Referral`: Guest referral tracking (`referralCode`, `referredName`, `referredEmail`, `referredPhone`, `source`, `status`, `rewardPoints`).

## Shared Models
- `Lead`: Captures `leadSource`, `enquirySource`, `bookingValue`, `aiScore`, `leadQuality`. Linked 1:1 with `LeadAttribution`.
- `Contact`: Customer profile linked with leads and referral records.
- `Booking`: Downstream booking revenue source for ROAS calculation.
