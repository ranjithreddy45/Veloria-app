"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { createRunoAllocation } from "@/lib/runo-client";
import { logActivity } from "@/lib/activity-logger";

export async function initiateRunoCall(leadId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true },
    });

    if (!lead || !lead.contact.phone) {
      return { success: false, error: "Lead or contact phone not found." };
    }

    // Get the current user's phone to assign the call
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    });

    // Strip non-digits for Runo matching
    let agentPhone = user?.phone?.replace(/\D/g, "") || "";
    if (agentPhone.length > 10 && agentPhone.startsWith("91")) {
      agentPhone = agentPhone.substring(2);
    }
    
    // Ensure the lead's phone number has a country code, Runo typically expects this.
    // If it doesn't start with '+', we'll default to India '+91'.
    let customerPhone = lead.contact.phone;
    if (!customerPhone.startsWith("+")) {
      customerPhone = "+91" + customerPhone.replace(/\D/g, "");
    }

    await createRunoAllocation({
      name: `${lead.contact.firstName} ${lead.contact.lastName}`,
      number: customerPhone,
      email: lead.contact.email || undefined,
      notes: `Lead: ${lead.title}`,
      assignTo: agentPhone || undefined, // If agentPhone is missing, Runo allocates to common pool
    });

    await logActivity({
      action: "RUNO_CALL_INITIATED",
      entityType: "LEAD",
      entityId: lead.id,
      details: "Initiated a Runo call allocation.",
      userId: session.user.id,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to initiate Runo call:", error);
    return { success: false, error: error.message || "Failed to initiate call." };
  }
}
