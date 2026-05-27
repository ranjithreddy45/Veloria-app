"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentActivityTimeline } from "@/actions/agent-activity.actions";
import { format } from "date-fns";
import { Phone, Mail, MessageSquare, CheckCircle, StickyNote } from "lucide-react";

interface TimelineItem {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  date: string;
}

const typeIcons: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  TASK: CheckCircle,
  NOTE: StickyNote,
  SMS: MessageSquare,
  MEETING: CheckCircle,
};

const typeColors: Record<string, string> = {
  CALL: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  EMAIL: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
  WHATSAPP: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  TASK: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  NOTE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400",
  SMS: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  MEETING: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
};

interface Props {
  agentId: string;
}

export function AgentActivityTimeline({ agentId }: Props) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getAgentActivityTimeline(agentId);
      if (result.success) {
        setTimeline(result.data);
      }
    });
  }, [agentId]);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3">
            {timeline.map((item) => {
              const Icon = typeIcons[item.type] || StickyNote;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0"
                >
                  <div
                    className={`p-1.5 rounded-md mt-0.5 ${
                      typeColors[item.type] || typeColors.NOTE
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(item.date), "MMM d, h:mm a")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
