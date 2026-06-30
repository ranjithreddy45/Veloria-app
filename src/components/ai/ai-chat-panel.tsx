"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Send,
  Loader2,
  RotateCcw,
  Database,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

// ============================================================
// Derive the record the user is looking at from the URL, so the
// assistant understands "this lead / this booking" without an id.
// ============================================================

const CUID_RE = /^c[a-z0-9]{20,}$/i;

function deriveEntityContext(path: string): {
  entityType?: string;
  entityId?: string;
} {
  const segs = path.split("/").filter(Boolean);
  // Map the route's leading segment to an entity type.
  const typeBySegment: Record<string, string> = {
    leads: "lead",
    contacts: "contact",
    bookings: "booking",
    pipeline: "deal",
    quotes: "quote",
    contracts: "contract",
    invoices: "invoice",
    owners: "owner",
  };
  const head = segs[0];
  const entityType = typeBySegment[head];
  if (!entityType) return {};
  // The id is the first CUID-looking segment after the head.
  const entityId = segs.slice(1).find((s) => CUID_RE.test(s));
  return entityId ? { entityType, entityId } : {};
}

// ============================================================
// Types
// ============================================================

interface ChartData {
  type: "bar" | "pie";
  data: Array<{ name: string; value: number; fill?: string; deals?: number }>;
  title?: string;
  valueKey?: string;
  labelKey?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartData[];
}

// ============================================================
// Chart colors
// ============================================================

const DEFAULT_COLORS = [
  "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4",
  "#22c55e", "#ef4444", "#ec4899", "#6366f1",
];

// ============================================================
// Inline Chart Components
// ============================================================

function InlineBarChart({ chart }: { chart: ChartData }) {
  const formatValue = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v}`;
  };

  return (
    <div className="my-2 rounded-lg border bg-background/50 p-3">
      {chart.title && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">{chart.title}</p>
      )}
      <ResponsiveContainer width="100%" height={Math.max(140, chart.data.length * 36)}>
        <BarChart
          data={chart.data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [formatValue(value), "Value"]}
            contentStyle={{
              fontSize: "12px",
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              padding: "6px 10px",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {chart.data.map((entry, index) => (
              <Cell key={`bar-${index}`} fill={entry.fill ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InlinePieChart({ chart }: { chart: ChartData }) {
  const total = chart.data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="my-2 rounded-lg border bg-background/50 p-3">
      {chart.title && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">{chart.title}</p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chart.data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {chart.data.map((entry, index) => (
              <Cell key={`pie-${index}`} fill={entry.fill ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: "12px",
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              padding: "6px 10px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span className="text-[11px] text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {total > 0 && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Total: <span className="font-medium text-foreground">{total}</span>
        </p>
      )}
    </div>
  );
}

function InlineChart({ chart }: { chart: ChartData }) {
  if (chart.type === "bar") return <InlineBarChart chart={chart} />;
  if (chart.type === "pie") return <InlinePieChart chart={chart} />;
  return null;
}

// ============================================================
// Component
// ============================================================

export function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isToolCalling, setIsToolCalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const pathname = usePathname();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isToolCalling]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keyboard shortcut: Cmd+J / Ctrl+J to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Send message
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);
    setIsToolCalling(null);

    // Create a placeholder for the assistant message
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", charts: [] },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            path: pathname,
            ...deriveEntityContext(pathname ?? ""),
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events in buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);

            if (parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.content }
                    : m
                )
              );
            }

            if (parsed.chart) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, charts: [...(m.charts ?? []), parsed.chart as ChartData] }
                    : m
                )
              );
            }

            if (parsed.tool_call) {
              setIsToolCalling(parsed.tool_call);
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (parseErr) {
            // Skip non-JSON lines
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      // Remove empty assistant message on error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id === assistantId && !last.content) {
          return prev.filter((m) => m.id !== assistantId);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      setIsToolCalling(null);
    }
  }, [input, isLoading, messages, pathname]);

  // Handle key down in textarea
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Clear conversation
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setAiUnavailable(false);
    setIsToolCalling(null);
  }, []);

  // Format assistant message content (basic markdown)
  function formatContent(content: string) {
    // Convert bold markers
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i}>{part.slice(2, -2)}</strong>
        );
      }
      // Convert newlines to breaks
      return part.split("\n").map((line, j) => (
        <span key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </span>
      ));
    });
  }

  return (
    <>
      {/* Floating trigger button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
        size="icon"
        aria-label="Open Veloria AI Assistant"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Chat Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] md:w-[480px] p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <SheetTitle className="text-base font-semibold">
                  Veloria AI
                </SheetTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearChat}
                aria-label="New Chat"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div ref={scrollRef} className="p-4 space-y-4 min-h-0">
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Welcome to Veloria AI</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ask me about leads, deals, bookings, revenue, or anything CRM-related.
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs">
                    {[
                      "Is Veloria Grand — Hosa Road · Pearl Hall free on 12 Dec evening?",
                      "Log a call: Priya wants a 300-guest wedding in December",
                      "Show me the pipeline summary",
                      "Create a task to follow up with new leads tomorrow",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setInput(suggestion);
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        className="px-3 py-2 rounded-lg border text-left text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "max-w-[85%] bg-primary text-primary-foreground"
                        : "max-w-[95%] bg-muted text-foreground"
                    )}
                  >
                    {msg.role === "assistant" && !msg.content && isLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    ) : msg.role === "assistant" ? (
                      <div className="leading-relaxed">
                        {formatContent(msg.content)}
                        {/* Render inline charts */}
                        {msg.charts && msg.charts.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.charts.map((chart, i) => (
                              <InlineChart key={`chart-${i}`} chart={chart} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {/* Tool calling indicator */}
              {isToolCalling && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <Database className="h-3 w-3 animate-pulse" />
                    <span>Querying CRM data...</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="flex-shrink-0 border-t p-3 space-y-2">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Veloria AI..."
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-10 w-10 flex-shrink-0"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Press Enter to send, Shift+Enter for new line.{" "}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">
                {typeof navigator !== "undefined" &&
                navigator.platform?.includes("Mac")
                  ? "Cmd"
                  : "Ctrl"}
                +J
              </kbd>{" "}
              to toggle.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
