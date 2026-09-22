# Lead Notifications & SLA Alerts

## Overview

Automated alerts notifying staff of new lead assignments, follow-up deadlines, and SLA clock breaches.

---

## Notification Triggers

- **New Assignment**: Sends email and in-app notification to assigned user when `assignedToId` changes.
- **SLA Breach Alert**: War Room (`/leads/war-room`) highlights leads exceeding `firstContactDue` without response.
- **Follow-Up Reminder**: Daily morning email summary of leads due for contact.
