import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getOpenAIClient, getDefaultModel } from "@/lib/ai/openai-client";
import { buildCRMSystemPrompt } from "@/lib/ai/system-prompt";
import { CRM_TOOLS, executeCRMTool, type ToolContext } from "@/lib/ai/crm-tools";
import { chatRequestSchema } from "@/schemas/ai.schema";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 30 AI requests per minute per user
  const identifier = session?.user?.id || req.headers.get("x-forwarded-for") || "anonymous";
  const rateCheck = checkRateLimit(`ai-chat:${identifier}`, { maxRequests: 30, windowSeconds: 60 });
  if (!rateCheck.success) {
    return rateLimitResponse(rateCheck.resetIn);
  }

  // Permission check
  if (!hasPermission(session.user.role ?? "", "ai:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, context } = parsed.data;

  // Build the tool-execution context: who is acting, and from where.
  const toolCtx: ToolContext = {
    userId: session.user.id as string,
    userName: session.user.name ?? "Team Member",
    role: session.user.role ?? "",
    path: context?.path,
    entityType: context?.entityType,
    entityId: context?.entityId,
    entityLabel: context?.entityLabel,
  };

  // Get OpenAI client
  const openai = getOpenAIClient();

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (openai) {
          // Full AI mode with OpenAI
          const systemPrompt = buildCRMSystemPrompt({
            name: session.user.name,
            role: session.user.role ?? "Unknown",
            today: new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            }),
            context,
          });

          const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ];

          await streamWithToolCalls(openai, openaiMessages, controller, encoder, toolCtx);
        } else {
          // Fallback mode: use CRM tools directly with pattern matching
          const lastMessage = messages[messages.length - 1]?.content ?? "";
          await handleFallbackQuery(lastMessage, controller, encoder, session.user.name ?? "User");
        }
      } catch (error) {
        console.error("[AI Chat Error]", error);
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ============================================================
// Fallback Mode: Pattern-matching CRM queries without OpenAI
// ============================================================

async function handleFallbackQuery(
  query: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  userName: string
) {
  const q = query.toLowerCase();

  function send(text: string) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
  }

  function sendToolCall(name: string) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_call: name })}\n\n`));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sendChart(chart: Record<string, any>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chart })}\n\n`));
  }

  // Detect intent and call appropriate CRM tool
  if (q.includes("lead") && (q.includes("how many") || q.includes("count") || q.includes("this month") || q.includes("new"))) {
    sendToolCall("getLeadsData");
    const data = await executeCRMTool("getLeadsData", { dateRange: "this_month" });
    const parsed = JSON.parse(data);
    const count = parsed.count ?? parsed.leads?.length ?? 0;
    send(`📊 **Leads This Month**\n\nYou have **${count} leads** this month, ${userName}.\n\n`);
    if (parsed.leads && Array.isArray(parsed.leads)) {
      const STATUS_COLORS: Record<string, string> = {
        NEW: "#3b82f6", CONTACTED: "#8b5cf6", QUALIFIED: "#06b6d4",
        PROPOSAL_SENT: "#f59e0b", WON: "#22c55e", LOST: "#ef4444",
        JUNK: "#6b7280", UNKNOWN: "#9ca3af",
      };
      const statusCounts: Record<string, number> = {};
      for (const lead of parsed.leads) {
        const status = lead.status ?? "UNKNOWN";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
      const chartData = Object.entries(statusCounts).map(([name, value]) => ({
        name, value, fill: STATUS_COLORS[name] ?? "#8884d8",
      }));
      sendChart({ type: "pie", data: chartData, title: "Leads by Status" });
      send("**By Status:**\n");
      for (const [status, cnt] of Object.entries(statusCounts)) {
        send(`- ${status}: ${cnt}\n`);
      }
    }
  } else if (q.includes("pipeline") || (q.includes("deal") && q.includes("summary"))) {
    sendToolCall("getPipelineSummary");
    const data = await executeCRMTool("getPipelineSummary", {});
    const parsed = JSON.parse(data);
    send(`📈 **Pipeline Summary**\n\n`);
    if (parsed.stages && Array.isArray(parsed.stages)) {
      const STAGE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#22c55e", "#ef4444", "#ec4899", "#6366f1"];
      const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
      const chartData = parsed.stages.map((s: { stageName?: string; name?: string; totalValue?: number; dealCount?: number }, i: number) => ({
        name: s.stageName ?? s.name ?? "—",
        value: s.totalValue ?? 0,
        deals: s.dealCount ?? 0,
        fill: STAGE_COLORS[i % STAGE_COLORS.length],
      }));
      sendChart({ type: "bar", data: chartData, title: "Pipeline by Stage", valueKey: "value", labelKey: "name" });
      let totalDeals = 0;
      let totalValue = 0;
      for (const stage of parsed.stages) {
        totalDeals += stage.dealCount ?? 0;
        totalValue += stage.totalValue ?? 0;
      }
      send(`**Total Pipeline Value:** ${fmt(totalValue)}\n`);
      send(`**Total Deals:** ${totalDeals}\n`);
    } else {
      send(data);
    }
  } else if (q.includes("revenue") || q.includes("earning") || q.includes("income") || q.includes("sales")) {
    sendToolCall("getRevenueStats");
    const data = await executeCRMTool("getRevenueStats", { period: "this_month" });
    const parsed = JSON.parse(data);
    const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
    send(`💰 **Revenue Stats**\n\n`);
    const chartData = [
      { name: "This Month", value: parsed.thisMonth ?? 0, fill: "#3b82f6" },
      { name: "Last Month", value: parsed.lastMonth ?? 0, fill: "#8b5cf6" },
      { name: "This Quarter", value: parsed.thisQuarter ?? 0, fill: "#06b6d4" },
      { name: "All Time", value: parsed.total ?? 0, fill: "#22c55e" },
    ];
    sendChart({ type: "bar", data: chartData, title: "Revenue Breakdown", valueKey: "value", labelKey: "name" });
    send(`- **This Month:** ${fmt(parsed.thisMonth ?? 0)}\n`);
    send(`- **Last Month:** ${fmt(parsed.lastMonth ?? 0)}\n`);
    send(`- **This Quarter:** ${fmt(parsed.thisQuarter ?? 0)}\n`);
    send(`- **All Time Total:** ${fmt(parsed.total ?? 0)}\n`);
  } else if (q.includes("event") || q.includes("upcoming") || q.includes("booking")) {
    sendToolCall("getUpcomingEvents");
    const data = await executeCRMTool("getUpcomingEvents", { days: 30 });
    const parsed = JSON.parse(data);
    send(`📅 **Upcoming Events (Next 30 Days)**\n\n`);
    const events = parsed.upcomingEvents ?? parsed.events ?? [];
    if (Array.isArray(events) && events.length > 0) {
      // Group events by status for a pie chart
      const statusColors: Record<string, string> = {
        CONFIRMED: "#22c55e", PENDING: "#f59e0b", TENTATIVE: "#3b82f6",
        IN_PROGRESS: "#8b5cf6", COMPLETED: "#6b7280", CANCELLED: "#ef4444",
      };
      const statusCounts: Record<string, number> = {};
      for (const event of events) {
        const s = event.status ?? "UNKNOWN";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
      if (Object.keys(statusCounts).length > 1) {
        const chartData = Object.entries(statusCounts).map(([name, value]) => ({
          name, value, fill: statusColors[name] ?? "#8884d8",
        }));
        sendChart({ type: "pie", data: chartData, title: "Events by Status" });
      }
      for (const event of events) {
        const dateStr = event.eventDate ?? event.date;
        const date = dateStr ? new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBD";
        send(`- **${event.eventName ?? event.name}** — ${date} | ${event.venueName ?? ""} (${event.status})\n`);
      }
      send(`\n**Total:** ${parsed.count ?? events.length} events\n`);
    } else {
      send("No upcoming events in the next 30 days.\n");
    }
  } else if (q.includes("overdue") || (q.includes("task") && (q.includes("pending") || q.includes("due")))) {
    sendToolCall("getOverdueTasks");
    const data = await executeCRMTool("getOverdueTasks", {});
    const parsed = JSON.parse(data);
    send(`⚠️ **Overdue Tasks**\n\n`);
    const tasks = parsed.overdueTasks ?? parsed.tasks ?? [];
    if (Array.isArray(tasks) && tasks.length > 0) {
      // Group by priority for a pie chart
      const priorityColors: Record<string, string> = {
        URGENT: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e",
      };
      const priorityCounts: Record<string, number> = {};
      for (const task of tasks) {
        const p = task.priority ?? "MEDIUM";
        priorityCounts[p] = (priorityCounts[p] || 0) + 1;
      }
      if (Object.keys(priorityCounts).length > 1) {
        const chartData = Object.entries(priorityCounts).map(([name, value]) => ({
          name, value, fill: priorityColors[name] ?? "#8884d8",
        }));
        sendChart({ type: "pie", data: chartData, title: "Tasks by Priority" });
      }
      for (const task of tasks.slice(0, 10)) {
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN") : "No date";
        send(`- **${task.title}** — Due: ${dueDate} (${task.priority ?? "MEDIUM"})\n`);
      }
      send(`\n**Total Overdue:** ${parsed.count ?? tasks.length}\n`);
    } else {
      send("✅ No overdue tasks. Great work!\n");
    }
  } else if (q.includes("contact") && q.includes("search")) {
    const searchTerm = query.replace(/search|contact|find|for/gi, "").trim();
    sendToolCall("searchContacts");
    const data = await executeCRMTool("searchContacts", { query: searchTerm || query });
    const parsed = JSON.parse(data);
    send(`🔍 **Contact Search Results**\n\n`);
    if (parsed.contacts && Array.isArray(parsed.contacts) && parsed.contacts.length > 0) {
      for (const c of parsed.contacts.slice(0, 10)) {
        send(`- **${c.name}** — ${c.email ?? "No email"} | ${c.phone ?? "No phone"}${c.company ? ` | ${c.company}` : ""}\n`);
      }
    } else {
      send("No contacts found matching your query.\n");
    }
  } else {
    // Default: show available commands
    send(`👋 Hi ${userName}! I'm **Veloria AI**, your CRM assistant.\n\n`);
    send(`I'm running in **Smart Mode** (without OpenAI). Here's what I can help with:\n\n`);
    send(`- 📊 **"How many leads this month?"** — Lead stats\n`);
    send(`- 📈 **"Show me the pipeline summary"** — Deal pipeline overview\n`);
    send(`- 💰 **"Revenue stats"** — Revenue & invoicing data\n`);
    send(`- 📅 **"Upcoming events"** — Bookings in next 30 days\n`);
    send(`- ⚠️ **"Overdue tasks"** — Tasks needing attention\n`);
    send(`- 🔍 **"Search contact John"** — Find contacts\n\n`);
    send(`*Tip: Add a GOOGLE_AI_API_KEY (free) or OPENAI_API_KEY in Settings → Integrations to unlock full conversational AI mode.*\n`);
  }
}

// ============================================================
// Streaming with tool call handling loop (OpenAI mode)
// ============================================================

async function streamWithToolCalls(
  openai: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  toolCtx: ToolContext,
  depth = 0
): Promise<void> {
  // Safety: prevent infinite tool call loops
  if (depth > 5) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ content: "\n\n[Maximum tool call depth reached]" })}\n\n`)
    );
    return;
  }

  const response = await openai.chat.completions.create({
    model: getDefaultModel(),
    messages,
    tools: CRM_TOOLS,
    stream: true,
  });

  let assistantContent = "";
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  for await (const chunk of response) {
    const delta = chunk.choices[0]?.delta;
    const finishReason = chunk.choices[0]?.finish_reason;

    // Stream text content
    if (delta?.content) {
      assistantContent += delta.content;
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`)
      );
    }

    // Collect tool call chunks
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCalls.get(tc.index);
        if (existing) {
          existing.arguments += tc.function?.arguments ?? "";
        } else {
          toolCalls.set(tc.index, {
            id: tc.id ?? "",
            name: tc.function?.name ?? "",
            arguments: tc.function?.arguments ?? "",
          });
        }
      }
    }

    // Handle finish
    if (finishReason === "tool_calls" && toolCalls.size > 0) {
      // Build the assistant message with tool calls
      const assistantMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: "assistant",
        content: assistantContent || null,
        tool_calls: Array.from(toolCalls.values()).map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      };

      const updatedMessages = [...messages, assistantMsg];

      // Execute each tool call
      for (const [, tc] of toolCalls) {
        // Signal the client that we're executing a tool
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ tool_call: tc.name })}\n\n`)
        );

        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(tc.arguments || "{}");
        } catch {
          toolArgs = {};
        }

        const result = await executeCRMTool(tc.name, toolArgs, toolCtx);

        // Add tool result to messages
        updatedMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Recurse to continue the conversation with tool results
      await streamWithToolCalls(openai, updatedMessages, controller, encoder, toolCtx, depth + 1);
      return;
    }
  }
}
