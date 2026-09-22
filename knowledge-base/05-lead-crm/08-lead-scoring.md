# AI & Rule-Based Lead Scoring

## Overview

Veloria Grand uses a hybrid AI and heuristic scoring engine (`src/lib/ai/lead-scoring.ts` & `src/lib/lead-scoring.ts`) to calculate a score from 0 to 100 for every lead upon ingestion.

---

## Scoring Inputs & Rules

1. **Event Budget & Size**: High guest counts (> 300) and premium per-plate budgets (+30 pts).
2. **Event Date Urgency**: Events scheduled within 30–90 days receive high intent weighting (+20 pts).
3. **Contact Completeness**: Valid phone, email, and preferred venue specified (+15 pts).
4. **AI LLM Evaluation**: Optional LLM prompt evaluates inquiry text for sentiment, commercial viability, and urgency.

---

## Score Storage & Display

- **Fields**: `Lead.aiScore`, `Lead.aiScoreReason`, `Lead.aiScoredAt`.
- **UI Component**: Rendered as a visual badge and card in `ai-score-card.tsx` on the lead detail page.
