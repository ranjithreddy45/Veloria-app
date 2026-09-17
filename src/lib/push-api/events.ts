import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================================
// Internal domain events, written to the IntegrationEvent outbox.
//
// Nothing here calls Google Ads, Meta CAPI or anyone else. Consumers read the
// outbox on their own schedule, so a slow or broken consumer can never delay a
// push response or cost a lead. Writing the event is itself best-effort for the
// same reason: the lead already exists by the time we get here.
// ============================================================

export type DomainEventType = "lead.created" | "lead.status_changed" | "booking.created";

export async function emitDomainEvent(event: {
  type: DomainEventType;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.integrationEvent.create({
      data: {
        type: event.type,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "integration_event_write_failed",
        type: event.type,
        resource_id: event.resourceId,
        error: String(e),
      })
    );
  }
}
