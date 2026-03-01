import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { entityIds, entityType } = body as {
      entityIds: string[];
      entityType: string;
    };

    if (!entityIds || !Array.isArray(entityIds)) {
      return NextResponse.json(
        { error: "entityIds array required" },
        { status: 400 }
      );
    }

    const entities: Record<
      string,
      { id: string; name: string; email?: string; link: string }
    > = {};

    if (entityType === "LEAD") {
      const leads = await prisma.lead.findMany({
        where: { id: { in: entityIds } },
        select: {
          id: true,
          title: true,
          contact: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      for (const lead of leads) {
        entities[lead.id] = {
          id: lead.id,
          name: lead.title || `${lead.contact.firstName} ${lead.contact.lastName}`,
          email: lead.contact.email ?? undefined,
          link: `/crm/leads/${lead.id}`,
        };
      }
    } else if (entityType === "CONTACT") {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      for (const contact of contacts) {
        entities[contact.id] = {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`,
          email: contact.email ?? undefined,
          link: `/crm/contacts/${contact.id}`,
        };
      }
    }

    return NextResponse.json({ entities });
  } catch (error) {
    console.error("[CADENCE_ENTITIES_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
