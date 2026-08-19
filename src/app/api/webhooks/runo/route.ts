import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CallDisposition, CommunicationDirection, CommunicationType } from "@prisma/client";
import { RunoCallTranscriptionPayload } from "@/types/runo";

export const maxDuration = 60; // Allow up to 60 seconds to prevent timeouts

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("=====================================");
    console.log("🔥 INCOMING RUNO WEBHOOK 🔥");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=====================================");

    // Determine the type of payload we received
    const isAiTranscription = (!!payload.Transcription || !!payload.transcription) && !!payload.phoneNumber;

    if (isAiTranscription) {
      return await handleAiTranscriptionPayload(payload);
    } else {
      return await handleStandardCrmPayload(payload);
    }
  } catch (error: any) {
    console.error("Failed to process Runo Webhook:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}

// --------------------------------------------------------------------------------------
// HANDLER 1: AI Transcription Payload
// --------------------------------------------------------------------------------------
async function handleAiTranscriptionPayload(payload: RunoCallTranscriptionPayload | any) {
  const {
    callId,
    phoneNumber,
    userEmail,
    summary,
    callNotes,
    Transcription,
    transcription,
    actionItems,
    chapters,
    key_questions,
    keyQuestions,
    key_issues_discussed,
    issuesDiscussed,
    agentSpeakingTime,
    customerSpeakingTime,
    holdTime,
    deadAirTime,
    noiseTime
  } = payload;

  const actualTranscription = Transcription || transcription;
  const actualKeyQuestions = key_questions || keyQuestions;
  const actualIssuesDiscussed = key_issues_discussed || issuesDiscussed;

  const totalDuration = (Number(agentSpeakingTime) || 0) + 
                        (Number(customerSpeakingTime) || 0) + 
                        (Number(holdTime) || 0) + 
                        (Number(deadAirTime) || 0) + 
                        (Number(noiseTime) || 0);

  if (!phoneNumber) {
    return NextResponse.json({ error: "Missing phoneNumber in AI payload" }, { status: 400 });
  }

  // 1. Try to find the Agent by userEmail (from the new payload spec)
  let agentId: string | null = null;
  if (userEmail) {
    const agentEmail = userEmail.toLowerCase().trim();
    const agent = await prisma.user.findFirst({
      where: { email: agentEmail, isActive: true },
      select: { id: true },
    });
    if (agent) {
      agentId = agent.id;
    }
  }

  // 2. Find the Contact by Phone Number
  const logPhone = phoneNumber.replace(/\D/g, "").slice(-10);
  let contact = await prisma.contact.findFirst({
    where: { phone: { contains: logPhone } },
    select: { id: true },
  });

  if (!contact) {
    console.warn(`[Runo Webhook] AI Payload: No contact found for phone ending in: ${logPhone}. Creating Unknown Caller.`);
    contact = await prisma.contact.create({
      data: {
        firstName: "Unknown",
        lastName: "Caller",
        phone: phoneNumber,
      },
      select: { id: true },
    });
  }

  // 3. Fallback to finding the associated Agent by looking at the Contact's Leads
  if (!agentId) {
    const lead = await prisma.lead.findFirst({
      where: { contactId: contact.id, assignedToId: { not: null } },
      select: { assignedToId: true },
    });
    agentId = lead?.assignedToId || null;
  }

  if (!agentId) {
    console.warn(`[Runo Webhook] AI Payload: No active Agent found. Falling back to SUPER_ADMIN.`);
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { id: true },
    });
    agentId = admin?.id || null;
  }

  if (!agentId) {
    console.error(`[Runo Webhook] AI Payload: No admin available to fallback to.`);
    return NextResponse.json({ success: false, message: "No agent or admin found to assign call" }, { status: 200 });
  }

  // 4. Save the Communication AND CallLog to the Database
  let contentStr = summary || callNotes || "AI Call Transcription recorded.";
  
  await prisma.communication.create({
    data: {
      type: CommunicationType.CALL,
      content: contentStr,
      direction: CommunicationDirection.OUTBOUND, // Defaulting to outbound as it's missing
      contactId: contact.id,
      createdById: agentId,
      metadata: { 
        isAiTranscription: true,
        callId,
        chapters,
        keyQuestions: actualKeyQuestions,
        issuesDiscussed: actualIssuesDiscussed,
        actionItems,
        transcription: actualTranscription
      },
      // IMPORTANT: We must create a CallLog so it appears in the /crm/calls UI table
      callLog: {
        create: {
          disposition: CallDisposition.COMPLETED,
          durationSeconds: totalDuration || 0, // Fallback if missing
          externalCallId: callId || `ai_${logPhone}_${Date.now()}`,
          agentId: agentId,
          contactId: contact.id,
        }
      }
    },
  });

  console.log(`[Runo Webhook] Successfully logged AI Transcription for contact ${contact.id}`);
  return NextResponse.json({ success: true, message: "AI Transcription logged successfully" }, { status: 200 });
}

// --------------------------------------------------------------------------------------
// HANDLER 2: Standard CRM Payload
// --------------------------------------------------------------------------------------
async function handleStandardCrmPayload(payload: any) {
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
  let agent = await prisma.user.findFirst({
    where: { email: agentEmail, isActive: true },
    select: { id: true },
  });

  if (!agent) {
    console.warn(`[Runo Webhook] Standard Payload: No active Veloria user found with email: ${agentEmail}. Falling back to SUPER_ADMIN.`);
    agent = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json({ success: false, message: "No agent or admin found in Veloria to assign call" }, { status: 200 });
    }
  }

  // 2. Find the Contact in Veloria by Phone Number
  const logPhone = rawNumber.replace(/\D/g, "").slice(-10);
  if (!logPhone) {
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
  }

  let contact = await prisma.contact.findFirst({
    where: { phone: { contains: logPhone } },
    select: { id: true },
  });

  if (!contact) {
    console.warn(`[Runo Webhook] Standard Payload: No contact found for phone ending in: ${logPhone}. Creating Unknown Caller.`);
    contact = await prisma.contact.create({
      data: {
        firstName: "Unknown",
        lastName: "Caller",
        phone: rawNumber,
      },
      select: { id: true },
    });
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
  const callTimeMs = new Date(CallTime).getTime();
  const externalCallId = `runo_${UserId}_${logPhone}_${callTimeMs}`;

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
}
