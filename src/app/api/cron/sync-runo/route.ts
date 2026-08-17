import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRunoCallLogs } from "@/lib/runo-client";
import { CallDisposition, CommunicationDirection, CommunicationType } from "@prisma/client";

// Ensure this only runs on the server (Cron or manual sync trigger)
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Simple cron secret validation
    const secret = searchParams.get("secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Default to yesterday, or allow passing a date YYYY-MM-DD
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = searchParams.get("date") || yesterday.toISOString().split("T")[0];
    
    // Allow dryRun for testing without modifying the database
    const isDryRun = searchParams.get("dryRun") === "true";

    console.log(`Starting Runo call logs sync for date: ${dateStr}${isDryRun ? ' (DRY RUN)' : ''}`);

    // 1. Fetch Runo users to map callerId to Veloria Users
    const usersRes = await fetch("https://api.runo.in/v1/user", {
      headers: { "Auth-Key": process.env.RUNO_API_KEY! },
    });
    
    if (!usersRes.ok) {
      throw new Error(`Failed to fetch Runo users: ${usersRes.statusText}`);
    }
    
    const usersJson = await usersRes.json();
    const runoUsers = usersJson.data || [];
    
    // Build a map of Runo userId -> Veloria User ID
    // Match by phone or email
    const veloriaUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, phone: true, email: true },
    });

    const runoUserToVeloriaUserId = new Map<string, string>();
    for (const ru of runoUsers) {
      const runoPhone = ru.phoneNumber?.replace(/\D/g, "").slice(-10);
      const runoEmail = ru.email?.toLowerCase();
      
      const vUser = veloriaUsers.find((vu) => {
        const vuPhone = vu.phone?.replace(/\D/g, "").slice(-10);
        return (vuPhone && vuPhone === runoPhone) || (vu.email.toLowerCase() === runoEmail);
      });
      
      if (vUser) {
        runoUserToVeloriaUserId.set(ru.userId, vUser.id);
      }
    }

    // 2. Fetch Call Logs from Runo
    const logs = await fetchRunoCallLogs(dateStr);
    console.log(`Fetched ${logs.length} call logs from Runo`);

    let syncedCount = 0;
    let skippedCount = 0;
    const dryRunPayloads: any[] = [];

    // 3. Process logs and save to database
    for (const log of logs) {
      if (!log.callId) continue;
      
      // Check if we already have this call log (idempotency)
      const existing = await prisma.callLog.findFirst({
        where: { externalCallId: log.callId },
      });
      
      if (existing) {
        skippedCount++;
        continue;
      }

      // Map Runo agent -> Veloria User
      const agentId = runoUserToVeloriaUserId.get(log.callerId);
      if (!agentId) {
        // We can't log a call without an agent, or we assign it to a default admin.
        // For now, we'll skip if no agent matched.
        console.warn(`No Veloria user found for Runo user: ${log.calledBy} (${log.callerId})`);
        skippedCount++;
        continue;
      }

      // Find the Contact in Veloria by phone number
      const logPhone = log.phoneNumber?.replace(/\D/g, "").slice(-10);
      if (!logPhone) {
        skippedCount++;
        continue;
      }

      // We just pick the first contact that matches the phone
      const contact = await prisma.contact.findFirst({
        where: {
          phone: { contains: logPhone },
        },
        select: { id: true },
      });

      if (!contact) {
        // If contact doesn't exist, we skip. Alternatively, we could create a new contact.
        skippedCount++;
        continue;
      }

      // Map disposition
      let disposition: any = CallDisposition.COMPLETED;
      if (log.type === "missed" || log.status?.toLowerCase().includes("no answer") || log.tag === "unanswered") {
        disposition = CallDisposition.NO_ANSWER;
      } else if (log.status?.toLowerCase().includes("busy")) {
        disposition = CallDisposition.BUSY;
      }
      
      // Create Communication and CallLog
      const dbPayload = {
        type: CommunicationType.CALL,
        content: `Call log synced from Runo. Disposition: ${log.status || log.type}`,
        direction: log.type === "incoming" ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
        contactId: contact.id,
        createdById: agentId,
        createdAt: log.startTime ? new Date(log.startTime * 1000) : new Date(),
        metadata: { runoData: log },
        callLog: {
          create: {
            disposition,
            durationSeconds: log.duration || 0,
            externalCallId: log.callId,
            agentId: agentId,
            contactId: contact.id,
          }
        }
      };

      if (isDryRun) {
        dryRunPayloads.push(dbPayload);
        syncedCount++;
      } else {
        await prisma.communication.create({
          data: dbPayload,
        });
        syncedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: isDryRun ? "Dry run complete" : "Sync complete",
      syncedCount,
      skippedCount,
      totalRunoLogs: logs.length,
      ...(isDryRun && { dryRunPayloads })
    });
  } catch (error: any) {
    console.error("Runo sync error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
