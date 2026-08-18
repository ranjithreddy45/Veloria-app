import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CallDisposition, CommunicationDirection, CommunicationType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("=====================================");
    console.log("🔥 INCOMING RUNO WEBHOOK 🔥");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=====================================");

    const {
      Number: rawNumber,
      EmpEmail,
      CallType,
      Status,
      CallDuration,
      CallTime,
      UserId,
      RecordingUrl,
      Notes,
    } = payload;

    if (!rawNumber || !EmpEmail) {
      return NextResponse.json({ error: "Missing required fields (Number, EmpEmail)" }, { status: 400 });
    }

    // 1. Find the Agent (Veloria User) by matching the Email
    const agentEmail = EmpEmail.toLowerCase().trim();
    const agent = await prisma.user.findFirst({
      where: { email: agentEmail, isActive: true },
      select: { id: true },
    });

    if (!agent) {
      console.warn(`[Runo Webhook] No active Veloria user found with email: ${agentEmail}`);
      return NextResponse.json({ success: false, message: "Agent not found in Veloria" }, { status: 200 });
    }

    // 2. Find the Contact in Veloria by Phone Number
    const logPhone = rawNumber.replace(/\D/g, "").slice(-10);
    if (!logPhone) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { phone: { contains: logPhone } },
      select: { id: true },
    });

    if (!contact) {
      console.warn(`[Runo Webhook] No contact found for phone ending in: ${logPhone}`);
      return NextResponse.json({ success: false, message: "Contact not found in Veloria" }, { status: 200 });
    }

    // 3. Map Disposition & Direction
    let disposition: CallDisposition = CallDisposition.COMPLETED;
    const lowerStatus = Status?.toLowerCase() || "";
    const lowerType = CallType?.toLowerCase() || "";
    
    if (lowerType === "missed" || lowerStatus.includes("no answer") || lowerStatus.includes("unanswered")) {
      disposition = CallDisposition.NO_ANSWER;
    } else if (lowerStatus.includes("busy")) {
      disposition = CallDisposition.BUSY;
    }

    const direction = lowerType === "incoming" 
      ? CommunicationDirection.INBOUND 
      : CommunicationDirection.OUTBOUND;

    // 4. Generate a Pseudo-ID since the Webhook lacks a `CallId`
    // Using UserId + Number + CallTime ensures idempotency for the same exact call.
    const callTimeMs = new Date(CallTime).getTime();
    const externalCallId = `runo_${UserId}_${logPhone}_${callTimeMs}`;

    // Check if we already logged this exact call
    const existing = await prisma.callLog.findFirst({
      where: { externalCallId },
    });

    if (existing) {
      console.log(`[Runo Webhook] Call already exists (externalCallId: ${externalCallId})`);
      return NextResponse.json({ success: true, message: "Call already logged" }, { status: 200 });
    }

    // 5. Save the Call Log to the Database
    let contentStr = `Live call log from Runo. Disposition: ${Status || CallType}`;
    if (Notes) {
      contentStr += `\n\nNotes: ${Notes}`;
    }

    await prisma.communication.create({
      data: {
        type: CommunicationType.CALL,
        content: contentStr,
        direction,
        contactId: contact.id,
        createdById: agent.id,
        createdAt: new Date(CallTime),
        metadata: { runoWebhookPayload: payload },
        callLog: {
          create: {
            disposition,
            durationSeconds: CallDuration || 0,
            externalCallId,
            agentId: agent.id,
            contactId: contact.id,
            recordingUrl: RecordingUrl || null,
          }
        }
      },
    });

    console.log(`[Runo Webhook] Successfully logged call for contact ${contact.id}`);
    return NextResponse.json({ success: true, message: "Call logged successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("Failed to process Runo Webhook:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}
