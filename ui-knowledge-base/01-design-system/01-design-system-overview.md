# Phase 01: Design System Overview

## 1. Executive Summary
Veloria Grand utilizes a **Tailwind CSS v4 + Shadcn UI / Radix Primitives** design system. The user interface visual language is grounded in OKLCH color space variables, glassmorphism backdrop surfaces, responsive component layouts, and strict utility-first styling (`cn()` utility merging `clsx` and `tailwind-merge`).

## 2. Core Technical Architecture
- **CSS Framework**: Tailwind CSS v4 (`src/app/globals.css`).
- **Color Space**: OKLCH tailored color variables (`oklch(0.978 0.0015 286)`).
- **Component Primitives**: Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, etc.).
- **Icons**: Lucide React (`lucide-react`).
- **Toast Engine**: Sonner (`sonner`).
- **Utility Engine**: `src/lib/utils.ts` (`cn(...inputs)`).
- **Theme Modes**: Light / Dark mode support via CSS variables (`.dark`).
