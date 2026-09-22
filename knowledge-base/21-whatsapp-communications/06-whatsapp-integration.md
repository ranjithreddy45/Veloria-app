# 06 WhatsApp Integration

`CODE VERIFIED`

- Integration provider defined in `WhatsAppConfig.provider`:
  - **Meta Cloud API v21.0**: Endpoint `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`. Authorization header `Bearer ${accessToken}`.
  - **Weflux BSP**: Endpoint `https://api.weflux.in/v2` (`wefluxSendText`, `wefluxSendTemplate`).
- Phone numbers normalized via `normalizePhone()`: removes spaces/dashes, strips leading `+`, prepends country code `91` for Indian mobile numbers starting 6-9.
