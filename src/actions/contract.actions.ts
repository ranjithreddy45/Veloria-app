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
import { getVerifiedContactIds } from "@/lib/portal-identity";
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

    // Atomic guarded update: only mutate while still DRAFT so a concurrent
    // send/sign (e.g. portal) cannot be silently overwritten (TOCTOU).
    const guarded = await prisma.contract.updateMany({
      where: { id, status: "DRAFT" },
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
    if (guarded.count === 0) {
      return {
        success: false as const,
        error: "Only draft contracts can be edited",
      };
    }
    const contract = await prisma.contract.findUniqueOrThrow({ where: { id } });

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

    // Atomic guarded delete: only remove while still DRAFT so a contract that
    // was sent/signed concurrently cannot be destroyed (TOCTOU).
    const removed = await prisma.contract.deleteMany({
      where: { id, status: "DRAFT" },
    });
    if (removed.count === 0) {
      return {
        success: false as const,
        error: "Only draft contracts can be deleted",
      };
    }

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
      select: { status: true, expiresAt: true },
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

    // Server-side expiry guard: never send a contract whose expiry is already
    // in the past — the client could only ever sign an expired document.
    if (existing.expiresAt && new Date(existing.expiresAt) <= new Date()) {
      return {
        success: false as const,
        error: "Contract has expired — update the expiry date before sending",
      };
    }

    // Atomic DRAFT -> SENT transition so a contract cannot be sent twice or
    // race a concurrent edit/delete (TOCTOU).
    const transitioned = await prisma.contract.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "SENT", sentAt: new Date() },
    });
    if (transitioned.count === 0) {
      return {
        success: false as const,
        error: "Only draft contracts can be sent",
      };
    }
    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id },
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

    // Await email + e-sign so a delivery failure surfaces to the user instead
    // of leaving the contract silently SENT-but-never-received (serverless: a
    // detached promise would not survive the response anyway).
    let deliveryWarning: string | undefined;
    const recipientEmail =
      contract.signerEmail || contract.contact?.email;
    if (!recipientEmail) {
      deliveryWarning =
        "Contract marked as sent, but no signer/contact email is on file — nothing was emailed.";
    } else {
      try {
        const emailResult = await sendEmail({
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
        });
        if (!emailResult.success) {
          deliveryWarning =
            "Contract marked as sent, but the email could not be delivered — please retry sending.";
        }

        // Trigger e-sign placeholder
        const esignResult = await requestSignature({
          contractId: contract.id,
          signerEmail: recipientEmail,
        });
        if (!esignResult.success && !deliveryWarning) {
          deliveryWarning =
            "Contract marked as sent, but the e-signature request failed — please retry sending.";
        }
      } catch (err) {
        console.error("[CONTRACT_DELIVERY_ERROR]", err);
        deliveryWarning =
          "Contract marked as sent, but delivery failed — please retry sending.";
      }
    }

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return {
      success: true as const,
      data: serialize(contract),
      ...(deliveryWarning ? { warning: deliveryWarning } : {}),
    };
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
      select: { status: true, title: true, notes: true },
    });

    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    // State-transition guard: a contract may only be marked SIGNED from a
    // SENT/VIEWED state — never from DRAFT/EXPIRED/already-SIGNED. This blocks
    // forcibly signing an unsent contract to fake compliance.
    if (existing.status !== "SENT" && existing.status !== "VIEWED") {
      return {
        success: false as const,
        error: "Contract must be sent or viewed before signing",
      };
    }

    // Manual staff-side marking (offline/paper signing) carries no e-sign
    // signature; record who recorded it for an accountability audit trail.
    const manualMark = !signatureData;
    const auditStamp = `Marked signed by ${
      session.user.name || session.user.email || session.user.id
    } on ${format(new Date(), "dd MMM yyyy HH:mm")}`;

    // Atomic SENT/VIEWED -> SIGNED transition so a portal sign happening
    // concurrently cannot be clobbered or double-processed (TOCTOU).
    const transitioned = await prisma.contract.updateMany({
      where: { id, status: { in: ["SENT", "VIEWED"] } },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData: signatureData || null,
        signedViaEsign: !!signatureData,
        ...(manualMark
          ? {
              notes: existing.notes
                ? `${existing.notes}\n${auditStamp}`
                : auditStamp,
            }
          : {}),
      },
    });
    if (transitioned.count === 0) {
      return {
        success: false as const,
        error: "Contract must be sent or viewed before signing",
      };
    }
    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id },
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

  // C9: verified-only, centralized contact resolution (M7 deletedAt handled).
  const contactIds = await getVerifiedContactIds(userId);
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

  // C9: verified-only, centralized contact resolution (M7 deletedAt handled).
  const contactIds = await getVerifiedContactIds(userId);
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
    },
  });

  if (!contract) return null;

  // Mark as VIEWED if currently SENT — atomic conditional update so two
  // concurrent portal opens don't both race on a stale SENT read. We only
  // report VIEWED when this call (or a prior one) actually moved it there.
  let effectiveStatus = contract.status;
  if (contract.status === "SENT") {
    try {
      await prisma.contract.updateMany({
        where: { id: contractId, status: "SENT" },
        data: { status: "VIEWED" },
      });
      // Whether we won the race or another viewer did, the client-facing
      // status is now VIEWED (it can only move forward from SENT).
      effectiveStatus = "VIEWED";
    } catch (err) {
      console.error("[PORTAL_CONTRACT_VIEW_ERROR]", err);
      // Non-fatal: fall back to the status we read so the contract still loads.
    }
  }

  return serialize({
    id: contract.id,
    title: contract.title,
    status: effectiveStatus,
    content: contract.content,
    sentAt: contract.sentAt,
    signedAt: contract.signedAt,
    expiresAt: contract.expiresAt,
    signerName: contract.signerName,
    // M2: signerEmail, notes, and template name are internal — never surfaced
    // to the client portal.
    signatureData: contract.signatureData,
    signedViaEsign: contract.signedViaEsign,
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

    // C9: only a VERIFIED portal identity may sign — otherwise a stranger who
    // registered the customer's email could sign their contract.
    const contactIds = await getVerifiedContactIds(userId);
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

    // Check expiry — transition to EXPIRED only while still signable so a
    // concurrent sign cannot be clobbered by this guard (atomic conditional).
    if (contract.expiresAt && new Date(contract.expiresAt) < new Date()) {
      await prisma.contract.updateMany({
        where: { id: contractId, status: { in: ["SENT", "VIEWED"] } },
        data: { status: "EXPIRED" },
      });
      return {
        success: false as const,
        error: "This contract has expired and can no longer be signed",
      };
    }

    // Atomic SENT/VIEWED -> SIGNED transition so two concurrent portal signs
    // (or a staff-side mark-signed) cannot both succeed (TOCTOU).
    const signed = await prisma.contract.updateMany({
      where: { id: contractId, status: { in: ["SENT", "VIEWED"] } },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData,
        signedViaEsign: true,
      },
    });
    if (signed.count === 0) {
      return {
        success: false as const,
        error: "Contract not found or already signed",
      };
    }
    const updated = await prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
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
