"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { requestApprovalIfNeeded } from "@/lib/approval-engine";
import { velosOnDealStage } from "@/lib/velos/triggers";

// ============================================================
// Types
// ============================================================

type CreateDealInput = {
  title: string;
  leadId: string;
  stageId: string;
  value: number;
  probability?: number;
  expectedCloseDate?: Date | null;
  assignedToId?: string | null;
  notes?: string | null;
};

type UpdateDealInput = {
  title?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: Date | null;
  assignedToId?: string | null;
  notes?: string | null;
  lostReason?: string | null;
};

type CreateStageInput = {
  name: string;
  color?: string;
  isWonStage?: boolean;
  isLostStage?: boolean;
};

type UpdateStageInput = {
  name?: string;
  color?: string;
};

// ============================================================
// Get Pipeline Stages (with Deals)
// ============================================================

export async function getPipelineStages() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: "asc" },
      include: {
        deals: {
          orderBy: { orderInStage: "asc" },
          include: {
            lead: {
              select: {
                id: true,
                title: true,
                source: true,
                eventType: true,
                eventDate: true,
                guestCount: true,
                estimatedValue: true,
                // Pull the contact in the SAME query — previously this was a
                // separate findUnique per deal (a classic N+1 on the board).
                contact: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    company: true,
                  },
                },
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            stage: {
              select: {
                id: true,
                name: true,
                color: true,
                isWonStage: true,
                isLostStage: true,
              },
            },
          },
        },
      },
    });

    // Reshape in memory — the contact now arrives via the lead include above,
    // so there are zero extra round-trips here.
    const stagesWithContacts = stages.map((stage) => ({
      ...stage,
      deals: stage.deals.map((deal) => {
        const { contact, ...leadRest } = deal.lead ?? { contact: null };
        return {
          ...deal,
          lead: deal.lead ? leadRest : deal.lead,
          value: Number(deal.value),
          contact: contact ?? null,
          aiScore: deal.aiScore ?? null,
          aiScoreReason: deal.aiScoreReason ?? null,
          aiFactors: deal.aiFactors ?? null,
          aiScoredAt: deal.aiScoredAt ?? null,
        };
      }),
    }));

    return { success: true as const, data: serialize(stagesWithContacts) };
  } catch (error) {
    console.error("[GET_PIPELINE_STAGES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch pipeline stages" };
  }
}

// ============================================================
// Create Deal
// ============================================================

export async function createDeal(data: CreateDealInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Validate lead exists and is not already converted
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId },
      include: { deal: { select: { id: true } } },
    });

    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    if (lead.deal) {
      return {
        success: false as const,
        error: "This lead already has an associated deal",
      };
    }

    // Validate stage exists
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: data.stageId },
    });

    if (!stage) {
      return { success: false as const, error: "Pipeline stage not found" };
    }

    // Get the highest orderInStage for the target stage
    const lastDeal = await prisma.deal.findFirst({
      where: { stageId: data.stageId },
      orderBy: { orderInStage: "desc" },
      select: { orderInStage: true },
    });

    const newOrder = (lastDeal?.orderInStage ?? -1) + 1;

    const deal = await prisma.deal.create({
      data: {
        title: data.title,
        leadId: data.leadId,
        stageId: data.stageId,
        value: data.value,
        probability: data.probability ?? 50,
        expectedCloseDate: data.expectedCloseDate ?? null,
        assignedToId: data.assignedToId ?? session.user.id as string,
        notes: data.notes ?? null,
        orderInStage: newOrder,
      },
      include: {
        lead: {
          select: {
            id: true,
            title: true,
            source: true,
            eventType: true,
            eventDate: true,
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
              },
            },
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
            isWonStage: true,
            isLostStage: true,
          },
        },
      },
    });

    // Update lead status to reflect pipeline entry
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { status: "QUALIFIED" },
    });

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { success: true as const, data: serialize({ ...deal, value: Number(deal.value) }) };
  } catch (error) {
    console.error("[CREATE_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to create deal" };
  }
}

// ============================================================
// Update Deal
// ============================================================

export async function updateDeal(id: string, data: UpdateDealInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Deal not found" };
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.expectedCloseDate !== undefined)
      updateData.expectedCloseDate = data.expectedCloseDate;
    if (data.assignedToId !== undefined)
      updateData.assignedToId = data.assignedToId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.lostReason !== undefined) updateData.lostReason = data.lostReason;

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        lead: {
          select: {
            id: true,
            title: true,
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
              },
            },
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
            isWonStage: true,
            isLostStage: true,
          },
        },
      },
    });

    revalidatePath("/pipeline");
    return { success: true as const, data: serialize({ ...deal, value: Number(deal.value) }) };
  } catch (error) {
    console.error("[UPDATE_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to update deal" };
  }
}

// ============================================================
// Move Deal (Drag & Drop)
// ============================================================

export async function moveDeal(
  dealId: string,
  newStageId: string,
  newOrderInStage: number
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, stageId: true, orderInStage: true, leadId: true, assignedToId: true, lead: { select: { assignedToId: true } } },
    });

    if (!deal) {
      return { success: false as const, error: "Deal not found" };
    }

    const newStage = await prisma.pipelineStage.findUnique({
      where: { id: newStageId },
      select: { id: true, name: true, isWonStage: true, isLostStage: true },
    });

    if (!newStage) {
      return { success: false as const, error: "Target stage not found" };
    }

    // Moving a deal into Won also flips its lead to WON — enforce the same
    // owner-required rule as updateLeadStatus (SCRM-004) so drag-and-drop can't
    // create an un-owned won lead (audit fix).
    if (newStage.isWonStage && !deal.lead?.assignedToId) {
      return { success: false as const, error: "Assign an owner to this lead before moving the deal to Won." };
    }

    const oldStageId = deal.stageId;
    const oldOrder = deal.orderInStage;
    const isMovingStages = oldStageId !== newStageId;

    await prisma.$transaction(async (tx) => {
      if (isMovingStages) {
        // Decrement orderInStage for deals after the old position in the old stage
        await tx.deal.updateMany({
          where: {
            stageId: oldStageId,
            orderInStage: { gt: oldOrder },
          },
          data: {
            orderInStage: { decrement: 1 },
          },
        });

        // Increment orderInStage for deals at/after the new position in the new stage
        await tx.deal.updateMany({
          where: {
            stageId: newStageId,
            orderInStage: { gte: newOrderInStage },
          },
          data: {
            orderInStage: { increment: 1 },
          },
        });
      } else {
        // Moving within the same stage
        if (newOrderInStage > oldOrder) {
          // Moving down: shift items between old+1 and new up by 1
          await tx.deal.updateMany({
            where: {
              stageId: oldStageId,
              orderInStage: { gt: oldOrder, lte: newOrderInStage },
              id: { not: dealId },
            },
            data: {
              orderInStage: { decrement: 1 },
            },
          });
        } else if (newOrderInStage < oldOrder) {
          // Moving up: shift items between new and old-1 down by 1
          await tx.deal.updateMany({
            where: {
              stageId: oldStageId,
              orderInStage: { gte: newOrderInStage, lt: oldOrder },
              id: { not: dealId },
            },
            data: {
              orderInStage: { increment: 1 },
            },
          });
        }
      }

      // Build the update for the moved deal
      const dealUpdate: Record<string, unknown> = {
        stageId: newStageId,
        orderInStage: newOrderInStage,
      };

      // Set wonDate/lostDate based on stage type
      if (newStage.isWonStage) {
        dealUpdate.wonDate = new Date();
        dealUpdate.lostDate = null;
        dealUpdate.lostReason = null;
      } else if (newStage.isLostStage) {
        dealUpdate.lostDate = new Date();
        dealUpdate.wonDate = null;
      } else {
        // Moving to a regular stage - clear won/lost dates
        dealUpdate.wonDate = null;
        dealUpdate.lostDate = null;
        dealUpdate.lostReason = null;
      }

      await tx.deal.update({
        where: { id: dealId },
        data: dealUpdate,
      });

      // Update lead status based on new stage
      if (newStage.isWonStage) {
        await tx.lead.update({
          where: { id: deal.leadId },
          data: { status: "WON" },
        });
      } else if (newStage.isLostStage) {
        await tx.lead.update({
          where: { id: deal.leadId },
          data: { status: "LOST" },
        });
      } else if (isMovingStages) {
        await tx.lead.update({
          where: { id: deal.leadId },
          data: { status: "NEGOTIATION" },
        });
      }
    });

    // When a deal is marked Won, raise an approval request for managerial
    // sign-off if it matches an active rule (e.g. value over a threshold).
    // Non-blocking oversight: the move has already been committed.
    if (newStage.isWonStage) {
      try {
        await requestApprovalIfNeeded(
          "DEAL",
          dealId,
          session.user.id as string
        );
      } catch (e) {
        console.error("[DEAL_APPROVAL_ERROR]", e);
      }
    }

    // Velos: award the stage event to the deal owner (idempotent per deal+stage),
    // or claw back sale-side points if the deal was lost. Best-effort — wrapped so
    // a points failure can never affect the move (which is already committed).
    if (isMovingStages) {
      await velosOnDealStage({
        dealId,
        ownerId: deal.assignedToId ?? deal.lead?.assignedToId ?? null,
        stageName: newStage.name,
        isLostStage: newStage.isLostStage,
      });
    }

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    revalidatePath("/approvals");
    return {
      success: true as const,
      data: {
        dealId,
        newStageId,
        newOrderInStage,
        isWonStage: newStage.isWonStage,
        isLostStage: newStage.isLostStage,
      },
    };
  } catch (error) {
    console.error("[MOVE_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to move deal" };
  }
}

// ============================================================
// Get Single Deal
// ============================================================

export async function getDeal(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            contact: true,
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        stage: true,
      },
    });

    if (!deal) {
      return { success: false as const, error: "Deal not found" };
    }

    return { success: true as const, data: serialize({ ...deal, value: Number(deal.value) }) };
  } catch (error) {
    console.error("[GET_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to fetch deal" };
  }
}

// ============================================================
// Delete Deal
// ============================================================

export async function deleteDeal(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { id: true, leadId: true },
    });

    if (!deal) {
      return { success: false as const, error: "Deal not found" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.deal.delete({ where: { id } });
      // Revert lead status
      await tx.lead.update({
        where: { id: deal.leadId },
        data: { status: "QUALIFIED" },
      });
    });

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to delete deal" };
  }
}

// ============================================================
// Create Pipeline Stage
// ============================================================

export async function createPipelineStage(data: CreateStageInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get the highest order
    const lastStage = await prisma.pipelineStage.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = (lastStage?.order ?? -1) + 1;

    const stage = await prisma.pipelineStage.create({
      data: {
        name: data.name,
        color: data.color ?? "#6366f1",
        order: newOrder,
        isWonStage: data.isWonStage ?? false,
        isLostStage: data.isLostStage ?? false,
      },
    });

    revalidatePath("/pipeline");
    revalidatePath("/settings/pipeline");
    return { success: true as const, data: serialize(stage) };
  } catch (error) {
    console.error("[CREATE_PIPELINE_STAGE_ERROR]", error);
    return { success: false as const, error: "Failed to create pipeline stage" };
  }
}

// ============================================================
// Update Pipeline Stage
// ============================================================

export async function updatePipelineStage(id: string, data: UpdateStageInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.pipelineStage.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Pipeline stage not found" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;

    const stage = await prisma.pipelineStage.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/pipeline");
    revalidatePath("/settings/pipeline");
    return { success: true as const, data: serialize(stage) };
  } catch (error) {
    console.error("[UPDATE_PIPELINE_STAGE_ERROR]", error);
    return { success: false as const, error: "Failed to update pipeline stage" };
  }
}

// ============================================================
// Delete Pipeline Stage
// ============================================================

export async function deletePipelineStage(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const stage = await prisma.pipelineStage.findUnique({
      where: { id },
      include: { _count: { select: { deals: true } } },
    });

    if (!stage) {
      return { success: false as const, error: "Pipeline stage not found" };
    }

    if (stage._count.deals > 0) {
      return {
        success: false as const,
        error:
          "Cannot delete a stage that has deals. Move or delete the deals first.",
      };
    }

    if (stage.isWonStage || stage.isLostStage) {
      return {
        success: false as const,
        error: "Cannot delete system stages (Won/Lost).",
      };
    }

    await prisma.$transaction(async (tx) => {
      const deletedOrder = stage.order;

      await tx.pipelineStage.delete({ where: { id } });

      // Reorder remaining stages
      await tx.pipelineStage.updateMany({
        where: { order: { gt: deletedOrder } },
        data: { order: { decrement: 1 } },
      });
    });

    revalidatePath("/pipeline");
    revalidatePath("/settings/pipeline");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_PIPELINE_STAGE_ERROR]", error);
    return { success: false as const, error: "Failed to delete pipeline stage" };
  }
}

// ============================================================
// Get Pipeline Stats
// ============================================================

export async function getPipelineStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [totalDeals, stages, wonDeals, allDeals] = await Promise.all([
      prisma.deal.count(),
      prisma.pipelineStage.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          isWonStage: true,
          isLostStage: true,
          probability: true,
          _count: { select: { deals: true } },
          deals: {
            select: { value: true, probability: true },
          },
        },
      }),
      prisma.deal.count({
        where: { stage: { isWonStage: true } },
      }),
      prisma.deal.aggregate({
        _sum: { value: true },
      }),
    ]);

    const totalValue = Number(allDeals._sum.value ?? 0);
    const conversionRate =
      totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

    const stageStats = stages.map((stage) => {
      const totalValue = stage.deals.reduce((sum, deal) => sum + Number(deal.value), 0);
      // Weighted value = Σ value × win-probability (deal's own, falling back to the
      // stage's). Open stages only — won/lost don't carry forecast weight.
      const weightedValue =
        stage.isWonStage || stage.isLostStage
          ? 0
          : stage.deals.reduce((sum, deal) => {
              const p = deal.probability ?? stage.probability ?? 0;
              return sum + Number(deal.value) * (p / 100);
            }, 0);
      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        isWonStage: stage.isWonStage,
        isLostStage: stage.isLostStage,
        probability: stage.probability,
        dealCount: stage._count.deals,
        totalValue,
        weightedValue: Math.round(weightedValue),
      };
    });

    // Open (non-won, non-lost) pipeline + its probability-weighted forecast.
    const openValue = stageStats.filter((s) => !s.isWonStage && !s.isLostStage).reduce((sum, s) => sum + s.totalValue, 0);
    const weightedForecast = stageStats.reduce((sum, s) => sum + s.weightedValue, 0);

    return {
      success: true as const,
      data: {
        totalDeals,
        totalValue,
        conversionRate,
        wonDeals,
        openValue,
        weightedForecast,
        stageStats,
      },
    };
  } catch (error) {
    console.error("[GET_PIPELINE_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch pipeline stats" };
  }
}

// ============================================================
// Get Leads Available for Pipeline (not yet converted)
// ============================================================

export async function getAvailableLeads(search?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const where: Record<string, unknown> = {
      deal: null, // Only leads without a deal
    };

    if (search?.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search.trim(), mode: "insensitive" } },
              { lastName: { contains: search.trim(), mode: "insensitive" } },
              { email: { contains: search.trim(), mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        estimatedValue: true,
        eventType: true,
        source: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
          },
        },
      },
    });

    return { success: true as const, data: serialize(leads) };
  } catch (error) {
    console.error("[GET_AVAILABLE_LEADS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch available leads" };
  }
}

// ============================================================
// Convert Deal to Booking
// ============================================================

export async function convertDealToBooking(data: {
  dealId: string;
  venueId: string;
  eventName: string;
  date: string; // ISO date string
  timeSlot: string;
  guestCount: number;
  totalAmount: number;
  specialRequests?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get deal with lead and contact
    const deal = await prisma.deal.findUnique({
      where: { id: data.dealId },
      include: {
        lead: {
          include: {
            contact: { select: { id: true } },
          },
        },
      },
    });

    if (!deal) {
      return { success: false as const, error: "Deal not found" };
    }

    if (!deal.lead?.contact?.id) {
      return { success: false as const, error: "Deal has no associated contact" };
    }

    // Check if deal already has a booking
    const existingBooking = await prisma.booking.findUnique({
      where: { dealId: data.dealId },
    });

    if (existingBooking) {
      return {
        success: false as const,
        error: "This deal already has a booking",
      };
    }

    // Generate booking number with retry for uniqueness (avoids TOCTOU race)
    const year = new Date().getFullYear();
    const bkPrefix = `BK-${year}-`;
    let bookingNumber: string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await prisma.booking.count();
      const candidate = `${bkPrefix}${String(count + 1 + attempt).padStart(4, "0")}`;

      const existing = await prisma.booking.findFirst({
        where: { bookingNumber: candidate },
      });

      if (!existing) {
        bookingNumber = candidate;
        break;
      }
    }

    if (!bookingNumber) {
      // Fallback: use timestamp-based unique number
      bookingNumber = `BK-${Date.now()}`;
    }

    const bookingDate = new Date(data.date);
    bookingDate.setHours(0, 0, 0, 0);

    if (Number.isNaN(bookingDate.getTime())) {
      return { success: false as const, error: "Invalid event date" };
    }

    // Reject past dates (a confirmed booking can't be in the past).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return { success: false as const, error: "Event date cannot be in the past" };
    }

    // Availability + blackout guard — mirror createBooking so a conversion
    // can never double-book a venue/slot or land on a blacked-out date.
    const slot = data.timeSlot as "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY";
    const slotConflicts =
      slot === "FULL_DAY"
        ? ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"]
        : [slot, "FULL_DAY"];
    const clash = await prisma.booking.findFirst({
      where: {
        venueId: data.venueId,
        date: bookingDate,
        status: { notIn: ["CANCELLED"] },
        timeSlot: { in: slotConflicts as ("MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY")[] },
      },
      select: { bookingNumber: true, eventName: true },
    });
    if (clash) {
      return {
        success: false as const,
        error: `Slot taken by ${clash.bookingNumber} — ${clash.eventName}`,
      };
    }
    const blackout = await prisma.blackoutDate.findFirst({
      where: {
        venueId: data.venueId,
        date: bookingDate,
        OR: [
          { timeSlot: null },
          { timeSlot: slot },
          ...(slot === "FULL_DAY"
            ? [
                { timeSlot: "MORNING" as const },
                { timeSlot: "AFTERNOON" as const },
                { timeSlot: "EVENING" as const },
              ]
            : []),
        ],
      },
      select: { reason: true },
    });
    if (blackout) {
      return {
        success: false as const,
        error: `Venue is blacked out: ${blackout.reason || "No reason specified"}`,
      };
    }

    // Create booking in a transaction
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          bookingNumber,
          eventName: data.eventName,
          eventType: deal.lead.eventType || "OTHER",
          date: bookingDate,
          timeSlot: data.timeSlot as "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY",
          guestCount: data.guestCount,
          totalAmount: data.totalAmount,
          specialRequests: data.specialRequests || null,
          venueId: data.venueId,
          contactId: deal.lead.contact!.id,
          dealId: deal.id,
          createdById: session.user!.id as string,
          status: "CONFIRMED",
        },
      });

      // Update lead status
      await tx.lead.update({
        where: { id: deal.leadId },
        data: { status: "WON" },
      });

      return newBooking;
    });

    revalidatePath("/pipeline");
    revalidatePath("/bookings");
    revalidatePath("/leads");

    return {
      success: true as const,
      data: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
    };
  } catch (error) {
    console.error("[CONVERT_DEAL_TO_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to convert deal to booking" };
  }
}

// ============================================================
// Get Team Members (for assignment)
// ============================================================

export async function getTeamMembers() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pipeline:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(users) };
  } catch (error) {
    console.error("[GET_TEAM_MEMBERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch team members" };
  }
}
