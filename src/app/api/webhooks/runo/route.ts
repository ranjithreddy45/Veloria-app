import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // 1. Read the JSON payload from Runo
    const payload = await request.json();

    // 2. Log it beautifully so we can see its exact structure
    console.log("=====================================");
    console.log("🔥 INCOMING RUNO WEBHOOK 🔥");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=====================================");

    // 3. Always return a 200 OK so Runo knows we received it
    return NextResponse.json({ success: true, message: "Webhook received" }, { status: 200 });
  } catch (error) {
    console.error("Failed to parse Runo Webhook:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
