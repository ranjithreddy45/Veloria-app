"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  contractSchema,
  contractTemplateSchema,
  type ContractInput,
  type ContractTemplateInput,
} from "@/schemas/contract.schema";
import type { ContractStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { contractSentEmail } from "@/lib/email-templates/contract-sent";
import { requestSignature } from "@/lib/esign";
import { format } from "date-fns";

// ============================================================
// Get Contracts (Paginated + Filtered)
// ============================================================

export async function getContracts(params?: {
  search?: string;
  status?: ContractStatus;
  contactId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { signerName: { contains: search, mode: "insensitive" } },
        { signerEmail: { contains: search, mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.contactId) {
      where.contactId = params.contactId;
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(contracts),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_CONTRACTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contracts" };
  }
}

// ============================================================
// Get Single Contract
// ============================================================

export async function getContract(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        contact: true,
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
            eventType: true,
            date: true,
            totalAmount: true,
            venue: { select: { name: true } },
          },
        },
        template: {
          select: { id: true, name: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!contract) {
      return { success: false as const, error: "Contract not found" };
    }

    return { success: true as const, data: serialize(contract) };
  } catch (error) {
    console.error("[GET_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contract" };
  }
}

// ============================================================
// Create Contract
// ============================================================

export async function createContract(data: ContractInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = contractSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const contractData = parsed.data;

    // If a template is selected, apply variable replacement
    let content = contractData.content;
    if (contractData.templateId) {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: contractData.templateId },
      });
      if (template) {
        // Fetch contact and booking for variable replacement
        const contact = await prisma.contact.findUnique({
          where: { id: contractData.contactId },
        });
        const booking = contractData.bookingId
          ? await prisma.booking.findUnique({
              where: { id: contractData.bookingId },
              include: { venue: { select: { name: true } } },
            })
          : null;

        const variables: Record<string, string> = {
          clientName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : "",
          eventDate: booking
            ? format(new Date(booking.date), "dd MMM yyyy")
            : "",
          venueName: booking?.venue?.name ?? "",
          totalAmount: booking
            ? Number(booking.totalAmount).toLocaleString("en-IN")
            : "",
          bookingNumber: booking?.bookingNumber ?? "",
          signerName: contractData.signerName ?? "",
          signerEmail: contractData.signerEmail ?? "",
          company: contact?.company ?? "",
          email: contact?.email ?? "",
          phone: contact?.phone ?? "",
        };

        // Replace all {{variable}} placeholders
        content = content.replace(
          /\{\{(\w+)\}\}/g,
          (_, key) => variables[key] ?? `{{${key}}}`
        );
      }
    }

    const contract = await prisma.contract.create({
      data: {
        title: contractData.title,
        content,
        status: "DRAFT",
        signerName: contractData.signerName || null,
        signerEmail: contractData.signerEmail || null,
        expiresAt: contractData.expiresAt || null,
        notes: contractData.notes || null,
        templateId: contractData.templateId || null,
        bookingId: contractData.bookingId || null,
        contactId: contractData.contactId,
        createdById: session.user.id,
      },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Contract",
      entityId: contract.id,
    });

    revalidatePath("/contracts");
    return { success: true as const, data: serialize(contract) };
  } catch (error) {
    console.error("[CREATE_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to create contract" };
  }
}

// ============================================================
// Update Contract
// ============================================================

export async function updateContract(id: string, data: ContractInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = contractSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.contract.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft contracts can be edited",
      };
    }

    const contractData = parsed.data;

    const contract = await prisma.contract.update({
      where: { id },
      data: {
        title: contractData.title,
        content: contractData.content,
        signerName: contractData.signerName || null,
        signerEmail: contractData.signerEmail || null,
        expiresAt: contractData.expiresAt || null,
        notes: contractData.notes || null,
        templateId: contractData.templateId || null,
        bookingId: contractData.bookingId || null,
        contactId: contractData.contactId,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Contract",
      entityId: contract.id,
    });

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, data: serialize(contract) };
  } catch (error) {
    console.error("[UPDATE_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to update contract" };
  }
}

// ============================================================
// Delete Contract (DRAFT only)
// ============================================================

export async function deleteContract(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.contract.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft contracts can be deleted",
      };
    }

    await prisma.contract.delete({ where: { id } });

    revalidatePath("/contracts");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to delete contract" };
  }
}

// ============================================================
// Send Contract
// ============================================================

export async function sendContract(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.contract.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft contracts can be sent",
      };
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      include: {
        contact: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Contract",
      entityId: contract.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Contract Sent",
      message: `Contract "${contract.title}" has been sent to ${contract.contact?.firstName} ${contract.contact?.lastName}.`,
      actionUrl: `/contracts/${contract.id}`,
    });

    // Fire-and-forget: Send contract email to signer or contact
    const recipientEmail =
      contract.signerEmail || contract.contact?.email;
    if (recipientEmail) {
      sendEmail({
        to: recipientEmail,
        subject: `Contract: ${contract.title}`,
        html: contractSentEmail({
          contactName: `${contract.contact?.firstName} ${contract.contact?.lastName}`,
          contractTitle: contract.title,
          signerName: contract.signerName ?? undefined,
          expiresAt: contract.expiresAt
            ? format(new Date(contract.expiresAt), "dd MMM yyyy")
            : undefined,
        }),
      }).catch((err) => console.error("[CONTRACT_EMAIL_ERROR]", err));

      // Trigger e-sign placeholder
      requestSignature({
        contractId: contract.id,
        signerEmail: recipientEmail,
      }).catch((err) => console.error("[ESIGN_ERROR]", err));
    }

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, data: serialize(contract) };
  } catch (error) {
    console.error("[SEND_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to send contract" };
  }
}

// ============================================================
// Mark Contract as Signed
// ============================================================

export async function markContractSigned(
  id: string,
  signatureData?: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.contract.findUnique({
      where: { id },
      select: { status: true, title: true },
    });

    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    if (existing.status !== "SENT" && existing.status !== "VIEWED") {
      return {
        success: false as const,
        error: "Contract must be sent or viewed before signing",
      };
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData: signatureData || null,
        signedViaEsign: !!signatureData,
      },
      include: {
        contact: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Contract",
      entityId: contract.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Contract Signed",
      message: `Contract "${contract.title}" has been signed by ${contract.contact?.firstName} ${contract.contact?.lastName}.`,
      actionUrl: `/contracts/${contract.id}`,
    });

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, data: serialize(contract) };
  } catch (error) {
    console.error("[SIGN_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to sign contract" };
  }
}

// ============================================================
// Get Contract Templates
// ============================================================

export async function getContractTemplates() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:templates")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const templates = await prisma.contractTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { contracts: true },
        },
      },
    });

    return { success: true as const, data: serialize(templates) };
  } catch (error) {
    console.error("[GET_CONTRACT_TEMPLATES_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch contract templates",
    };
  }
}

// ============================================================
// Get Single Contract Template
// ============================================================

export async function getContractTemplate(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:templates")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const template = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return { success: false as const, error: "Template not found" };
    }

    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[GET_CONTRACT_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch template" };
  }
}

// ============================================================
// Create Contract Template
// ============================================================

export async function createContractTemplate(data: ContractTemplateInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:templates")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = contractTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const templateData = parsed.data;

    // Auto-detect variables from content
    const detectedVars = Array.from(
      new Set(
        (templateData.content.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
          v.replace(/\{\{|\}\}/g, "")
        )
      )
    );

    const template = await prisma.contractTemplate.create({
      data: {
        name: templateData.name,
        description: templateData.description || null,
        content: templateData.content,
        variables:
          templateData.variables.length > 0
            ? templateData.variables
            : detectedVars,
        category: templateData.category || null,
        isActive: templateData.isActive,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "ContractTemplate",
      entityId: template.id,
    });

    revalidatePath("/settings/contract-templates");
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[CREATE_CONTRACT_TEMPLATE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to create contract template",
    };
  }
}

// ============================================================
// Update Contract Template
// ============================================================

export async function updateContractTemplate(
  id: string,
  data: ContractTemplateInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:templates")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = contractTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.contractTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Template not found" };
    }

    const templateData = parsed.data;

    // Auto-detect variables from content
    const detectedVars = Array.from(
      new Set(
        (templateData.content.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
          v.replace(/\{\{|\}\}/g, "")
        )
      )
    );

    const template = await prisma.contractTemplate.update({
      where: { id },
      data: {
        name: templateData.name,
        description: templateData.description || null,
        content: templateData.content,
        variables:
          templateData.variables.length > 0
            ? templateData.variables
            : detectedVars,
        category: templateData.category || null,
        isActive: templateData.isActive,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "ContractTemplate",
      entityId: template.id,
    });

    revalidatePath("/settings/contract-templates");
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[UPDATE_CONTRACT_TEMPLATE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update contract template",
    };
  }
}

// ============================================================
// Delete Contract Template
// ============================================================

export async function deleteContractTemplate(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:templates")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.contractTemplate.findUnique({
      where: { id },
      include: { _count: { select: { contracts: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Template not found" };
    }

    if (existing._count.contracts > 0) {
      return {
        success: false as const,
        error: `Template is used by ${existing._count.contracts} contract(s). Remove associations first.`,
      };
    }

    await prisma.contractTemplate.delete({ where: { id } });

    revalidatePath("/settings/contract-templates");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_CONTRACT_TEMPLATE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to delete contract template",
    };
  }
}

// ============================================================
// Get Contacts (for contract form)
// ============================================================

export async function getContactsForContract() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contacts = await prisma.contact.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
      },
      orderBy: { firstName: "asc" },
    });

    return { success: true as const, data: serialize(contacts) };
  } catch (error) {
    console.error("[GET_CONTACTS_FOR_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contacts" };
  }
}

// ============================================================
// Get Bookings (for contract form)
// ============================================================

export async function getBookingsForContract(contactId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: { notIn: ["CANCELLED"] },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        date: true,
        totalAmount: true,
        venue: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    return { success: true as const, data: serialize(bookings) };
  } catch (error) {
    console.error("[GET_BOOKINGS_FOR_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}

// ============================================================
// Get Active Templates (for contract form template selector)
// ============================================================

export async function getActiveTemplates() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contracts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const templates = await prisma.contractTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        variables: true,
        category: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(templates) };
  } catch (error) {
    console.error("[GET_ACTIVE_TEMPLATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch templates" };
  }
}

// ============================================================
// Portal: Get Contracts for Client
// ============================================================

export async function getPortalContracts(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) return [];

  const contacts = await prisma.contact.findMany({
    where: { email: user.email },
    select: { id: true },
  });

  const contactIds = contacts.map((c) => c.id);
  if (contactIds.length === 0) return [];

  const contracts = await prisma.contract.findMany({
    where: {
      contactId: { in: contactIds },
      status: { notIn: ["DRAFT"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: { eventName: true, bookingNumber: true },
      },
    },
  });

  return serialize(
    contracts.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      sentAt: c.sentAt,
      signedAt: c.signedAt,
      expiresAt: c.expiresAt,
      signerName: c.signerName,
      createdAt: c.createdAt,
      eventName: c.booking?.eventName ?? null,
      bookingNumber: c.booking?.bookingNumber ?? null,
    }))
  );
}

// ============================================================
// Portal: Get Single Contract for Client
// ============================================================

export async function getPortalContract(
  userId: string,
  contractId: string
) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) return null;

  const contacts = await prisma.contact.findMany({
    where: { email: user.email },
    select: { id: true },
  });

  const contactIds = contacts.map((c) => c.id);
  if (contactIds.length === 0) return null;

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      contactId: { in: contactIds },
      status: { notIn: ["DRAFT"] },
    },
    include: {
      contact: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
        },
      },
      booking: {
        select: {
          eventName: true,
          bookingNumber: true,
          date: true,
          venue: { select: { name: true } },
        },
      },
      template: {
        select: { name: true },
      },
    },
  });

  if (!contract) return null;

  // Mark as VIEWED if currently SENT
  if (contract.status === "SENT") {
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "VIEWED" },
    });
  }

  return serialize({
    id: contract.id,
    title: contract.title,
    status: contract.status === "SENT" ? "VIEWED" : contract.status,
    content: contract.content,
    sentAt: contract.sentAt,
    signedAt: contract.signedAt,
    expiresAt: contract.expiresAt,
    signerName: contract.signerName,
    signerEmail: contract.signerEmail,
    signatureData: contract.signatureData,
    signedViaEsign: contract.signedViaEsign,
    notes: contract.notes,
    createdAt: contract.createdAt,
    contact: contract.contact,
    booking: contract.booking
      ? {
          eventName: contract.booking.eventName,
          bookingNumber: contract.booking.bookingNumber,
          date: contract.booking.date,
          venueName: contract.booking.venue?.name ?? null,
        }
      : null,
    templateName: contract.template?.name ?? null,
  });
}

// ============================================================
// Portal: Sign Contract (Client-side)
// ============================================================

export async function portalSignContract(
  userId: string,
  contractId: string,
  signatureData: string
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.id !== userId) {
      return { success: false as const, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    const contacts = await prisma.contact.findMany({
      where: { email: user.email },
      select: { id: true },
    });

    const contactIds = contacts.map((c) => c.id);
    if (contactIds.length === 0) {
      return { success: false as const, error: "Unauthorized" };
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        contactId: { in: contactIds },
        status: { in: ["SENT", "VIEWED"] },
      },
    });

    if (!contract) {
      return {
        success: false as const,
        error: "Contract not found or already signed",
      };
    }

    // Check expiry
    if (contract.expiresAt && new Date(contract.expiresAt) < new Date()) {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "EXPIRED" },
      });
      return {
        success: false as const,
        error: "This contract has expired",
      };
    }

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData,
        signedViaEsign: true,
      },
    });

    revalidatePath(`/portal/contracts/${contractId}`);
    revalidatePath(`/contracts/${contractId}`);
    revalidatePath("/contracts");

    return { success: true as const, data: serialize(updated) };
  } catch (error) {
    console.error("[PORTAL_SIGN_CONTRACT_ERROR]", error);
    return { success: false as const, error: "Failed to sign contract" };
  }
}
