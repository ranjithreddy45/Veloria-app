"use client";

import { useState } from "react";
import { AgentMetricsCards } from "./agent-metrics-cards";
import { AgentActivityTimeline } from "./agent-activity-timeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, MessageSquare, Users, CheckCircle } from "lucide-react";

interface AgentStat {
  agent: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    image: string | null;
  };
  totalCalls: number;
  avgCallDuration: number;
  totalCallDuration: number;
  totalCommunications: number;
  assignedLeads: number;
  completedTasks: number;
}

interface Props {
  initialData: AgentStat[];
}

export function AgentActivityDashboard({ initialData }: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const selectedAgent = initialData.find((a) => a.agent.id === selectedAgentId);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <div className="flex items-center gap-4">
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select an agent to view details" />
          </SelectTrigger>
          <SelectContent>
            {initialData.map((item) => (
              <SelectItem key={item.agent.id} value={item.agent.id}>
                {item.agent.name || item.agent.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Agent Metrics */}
      {selectedAgent && <AgentMetricsCards stats={selectedAgent} />}

      {/* Selected Agent Timeline */}
      {selectedAgentId && (
        <AgentActivityTimeline agentId={selectedAgentId} />
      )}

      {/* Agent Ranking Table */}
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardHeader>
          <CardTitle>Agent Rankings</CardTitle>
          <p className="text-[13px] text-muted-foreground">
            Calls, conversations and follow-through, ranked across the team.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-[50px]">#</TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agent</TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">
                  <Phone className="mr-1 inline size-3.5" />
                  Calls
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">
                  <MessageSquare className="mr-1 inline size-3.5" />
                  Comms
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">
                  <Users className="mr-1 inline size-3.5" />
                  Leads
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">
                  <CheckCircle className="mr-1 inline size-3.5" />
                  Tasks
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">Total Talk Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No agent activity recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                initialData.map((item, index) => (
                  <TableRow
                    key={item.agent.id}
                    className={cn(
                      "h-14 cursor-pointer transition-colors hover:bg-muted/40",
                      selectedAgentId === item.agent.id && "bg-muted/50"
                    )}
                    onClick={() => setSelectedAgentId(item.agent.id)}
                  >
                    <TableCell className="numeric text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.agent.image || ""} />
                          <AvatarFallback className="text-xs">
                            {(item.agent.name || item.agent.email)
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[13px] font-medium">
                            {item.agent.name || item.agent.email}
                          </p>
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
                            {item.agent.role.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="numeric text-right font-medium">
                      {item.totalCalls}
                    </TableCell>
                    <TableCell className="numeric text-right text-muted-foreground">
                      {item.totalCommunications}
                    </TableCell>
                    <TableCell className="numeric text-right text-muted-foreground">
                      {item.assignedLeads}
                    </TableCell>
                    <TableCell className="numeric text-right text-muted-foreground">
                      {item.completedTasks}
                    </TableCell>
                    <TableCell className="numeric text-right">
                      {formatDuration(item.totalCallDuration)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
