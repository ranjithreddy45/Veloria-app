# RESPONSIVE AUTHENTICATION UI FORENSICS

## 1. Breakpoint Adaptations

The authentication UI adapts across Desktop, Tablet, and Mobile viewports using Tailwind CSS v4 responsive utilities.

| Element / Viewport | Desktop (≥ 1024px) | Tablet (768px - 1023px) | Mobile (< 768px) |
|---|---|---|---|
| **Outer Container** | Centered glass card (`max-w-md`) | Centered glass card (`max-w-md`) | Full screen layout (`p-4 w-full`) |
| **Branding Crest** | Large 48px crest (`size-12`) | Large 48px crest (`size-12`) | Medium 40px crest (`size-10`) |
| **Form Padding** | `p-8` (32px inner padding) | `p-6` (24px inner padding) | `p-4` (16px inner padding) |
| **Inputs & Buttons** | Height 44px (`h-11`) | Height 44px (`h-11`) | Height 44px (`h-11`, touch target compliant) |
| **2FA Code Input** | Character tracking `tracking-[0.35em]` | Character tracking `tracking-[0.35em]` | Character tracking `tracking-[0.25em]` |
