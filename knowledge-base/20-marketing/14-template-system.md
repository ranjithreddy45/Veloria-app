# 14 Template System

`CODE VERIFIED`

- `EmailTemplate` model stores reusable campaign content (`name`, `subject`, `htmlContent`, `category`).
- Placeholder interpolation engine replaces tokens (`{{firstName}}`, `{{lastName}}`, `{{eventName}}`, `{{venueName}}`, `{{quoteUrl}}`) during email rendering.
