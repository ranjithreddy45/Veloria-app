"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  currencySchema,
  updateExchangeRateSchema,
  type CurrencyInput,
} from "@/schemas/currency.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get All Currencies
// ============================================================

export async function getCurrencies() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const currencies = await prisma.currency.findMany({
      orderBy: [{ code: "asc" }],
    });

    return { success: true as const, data: serialize(currencies) };
  } catch (error) {
    console.error("[GET_CURRENCIES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch currencies" };
  }
}

// ============================================================
// Get Single Currency by Code
// ============================================================

export async function getCurrency(code: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const currency = await prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!currency) {
      return { success: false as const, error: "Currency not found" };
    }

    return { success: true as const, data: serialize(currency) };
  } catch (error) {
    console.error("[GET_CURRENCY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch currency" };
  }
}

// ============================================================
// Create Currency
// ============================================================

export async function createCurrency(data: CurrencyInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = currencySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const currencyData = parsed.data;

    // Check if currency code already exists
    const existing = await prisma.currency.findUnique({
      where: { code: currencyData.code.toUpperCase() },
    });

    if (existing) {
      return {
        success: false as const,
        error: `Currency with code "${currencyData.code.toUpperCase()}" already exists`,
      };
    }

    const currency = await prisma.currency.create({
      data: {
        code: currencyData.code.toUpperCase(),
        name: currencyData.name,
        symbol: currencyData.symbol,
        exchangeRate: currencyData.exchangeRate,
        lastUpdated: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Currency",
      entityId: currency.id,
      changes: {
        code: currency.code,
        name: currency.name,
        exchangeRate: currencyData.exchangeRate,
      },
    });

    revalidatePath("/settings/integrations/currency");
    return { success: true as const, data: serialize(currency) };
  } catch (error) {
    console.error("[CREATE_CURRENCY_ERROR]", error);
    return { success: false as const, error: "Failed to create currency" };
  }
}

// ============================================================
// Update Currency
// ============================================================

export async function updateCurrency(id: string, data: CurrencyInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = currencySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const currencyData = parsed.data;

    const existing = await prisma.currency.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Currency not found" };
    }

    // Check for code uniqueness if code is being changed
    if (currencyData.code.toUpperCase() !== existing.code) {
      const codeConflict = await prisma.currency.findUnique({
        where: { code: currencyData.code.toUpperCase() },
      });
      if (codeConflict) {
        return {
          success: false as const,
          error: `Currency with code "${currencyData.code.toUpperCase()}" already exists`,
        };
      }
    }

    const currency = await prisma.currency.update({
      where: { id },
      data: {
        code: currencyData.code.toUpperCase(),
        name: currencyData.name,
        symbol: currencyData.symbol,
        exchangeRate: currencyData.exchangeRate,
        lastUpdated: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Currency",
      entityId: currency.id,
      changes: {
        code: currency.code,
        name: currency.name,
        exchangeRate: currencyData.exchangeRate,
      },
    });

    revalidatePath("/settings/integrations/currency");
    return { success: true as const, data: serialize(currency) };
  } catch (error) {
    console.error("[UPDATE_CURRENCY_ERROR]", error);
    return { success: false as const, error: "Failed to update currency" };
  }
}

// ============================================================
// Delete Currency
// ============================================================

export async function deleteCurrency(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.currency.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Currency not found" };
    }

    // Prevent deleting INR (base currency)
    if (existing.code === "INR") {
      return {
        success: false as const,
        error: "Cannot delete INR — it is the base currency",
      };
    }

    await prisma.currency.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Currency",
      entityId: id,
      changes: { code: existing.code, name: existing.name },
    });

    revalidatePath("/settings/integrations/currency");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_CURRENCY_ERROR]", error);
    return { success: false as const, error: "Failed to delete currency" };
  }
}

// ============================================================
// Update Exchange Rate (quick inline update)
// ============================================================

export async function updateExchangeRate(id: string, newRate: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateExchangeRateSchema.safeParse({
      exchangeRate: newRate,
    });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.currency.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Currency not found" };
    }

    // Prevent editing INR rate
    if (existing.code === "INR") {
      return {
        success: false as const,
        error: "Cannot change INR exchange rate — it is the base currency",
      };
    }

    const oldRate = Number(existing.exchangeRate);

    const currency = await prisma.currency.update({
      where: { id },
      data: {
        exchangeRate: parsed.data.exchangeRate,
        lastUpdated: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Currency",
      entityId: currency.id,
      changes: {
        code: existing.code,
        exchangeRate: { from: oldRate, to: parsed.data.exchangeRate },
      },
    });

    revalidatePath("/settings/integrations/currency");
    return { success: true as const, data: serialize(currency) };
  } catch (error) {
    console.error("[UPDATE_EXCHANGE_RATE_ERROR]", error);
    return { success: false as const, error: "Failed to update exchange rate" };
  }
}

// ============================================================
// Convert Amount Between Currencies
// ============================================================

export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "currency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (amount < 0) {
      return { success: false as const, error: "Amount must be non-negative" };
    }

    // Same currency — no conversion needed
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return {
        success: true as const,
        data: {
          originalAmount: amount,
          convertedAmount: amount,
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          exchangeRate: 1,
        },
      };
    }

    const [fromCurr, toCurr] = await Promise.all([
      prisma.currency.findUnique({
        where: { code: fromCurrency.toUpperCase() },
      }),
      prisma.currency.findUnique({
        where: { code: toCurrency.toUpperCase() },
      }),
    ]);

    if (!fromCurr) {
      return {
        success: false as const,
        error: `Currency "${fromCurrency.toUpperCase()}" not found`,
      };
    }

    if (!toCurr) {
      return {
        success: false as const,
        error: `Currency "${toCurrency.toUpperCase()}" not found`,
      };
    }

    // Convert: fromCurrency -> INR -> toCurrency
    // All rates are stored relative to INR
    const fromRate = Number(fromCurr.exchangeRate);
    const toRate = Number(toCurr.exchangeRate);

    // amount in fromCurrency * fromRate = amount in INR
    // amount in INR / toRate = amount in toCurrency
    const amountInINR = amount * fromRate;
    const convertedAmount = amountInINR / toRate;
    const effectiveRate = fromRate / toRate;

    return {
      success: true as const,
      data: {
        originalAmount: amount,
        convertedAmount: Math.round(convertedAmount * 100) / 100,
        fromCurrency: fromCurr.code,
        toCurrency: toCurr.code,
        exchangeRate: Math.round(effectiveRate * 1000000) / 1000000,
      },
    };
  } catch (error) {
    console.error("[CONVERT_AMOUNT_ERROR]", error);
    return { success: false as const, error: "Failed to convert amount" };
  }
}
