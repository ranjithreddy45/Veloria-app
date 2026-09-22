# Phase 27: Master Manual Verification

## Outstanding Production Verification Items
1. **Razorpay Webhook Secret**: Verify `RAZORPAY_WEBHOOK_SECRET` environment variable in production deployment.
2. **AWS S3 Bucket Policy**: Verify CORS configuration and private bucket permissions for PDF storage.
3. **Meta WhatsApp Access Token**: Confirm permanent system user access token in Meta Business Suite.
4. **Resend Sender Domain**: Verify SPF / DKIM DNS records for automated email sending.
5. **Cron Scheduler Triggers**: Configure external HTTP cron runners with secret header `CRON_SECRET`.
6. **Biometric Push IP**: Whitelist biometric device gateway IPs on host firewall.
