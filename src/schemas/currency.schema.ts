import { z } from "zod";

// ============================================================
// Currency Schema
// ============================================================

export const currencySchema = z.object({
  code: z
    .string()
    .min(3, { error: "Currency code must be 3 characters" })
    .max(3, { error: "Currency code must be 3 characters" }),
  name: z.string().min(1, { error: "Name is required" }),
  symbol: z.string().min(1, { error: "Symbol is required" }),
  exchangeRate: z
    .number({ error: "Exchange rate must be a number" })
    .positive({ error: "Exchange rate must be positive" }),
});

export type CurrencyInput = z.infer<typeof currencySchema>;

// ============================================================
// Update Exchange Rate Schema
// ============================================================

export const updateExchangeRateSchema = z.object({
  exchangeRate: z
    .number({ error: "Exchange rate must be a number" })
    .positive({ error: "Exchange rate must be positive" }),
});

export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;
