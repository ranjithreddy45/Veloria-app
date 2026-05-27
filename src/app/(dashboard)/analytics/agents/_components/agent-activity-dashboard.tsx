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
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Agent Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-center">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Calls
                </TableHead>
                <TableHead className="text-center">
                  <MessageSquare className="h-4 w-4 inline mr-1" />
                  Comms
                </TableHead>
                <TableHead className="text-center">
                  <Users className="h-4 w-4 inline mr-1" />
                  Leads
                </TableHead>
                <TableHead className="text-center">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  Tasks
                </TableHead>
                <TableHead className="text-center">Total Talk Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground h-16">
                    No agent data available
                  </TableCell>
                </TableRow>
              ) : (
                initialData.map((item, index) => (
                  <TableRow
                    key={item.agent.id}
                    className={`hover:bg-muted/20 cursor-pointer ${
                      selectedAgentId === item.agent.id ? "bg-muted/30" : ""
                    }`}
                    onClick={() => setSelectedAgentId(item.agent.id)}
                  >
                    <TableCell className="font-medium text-muted-foreground">
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
                          <p className="font-medium text-sm">
                            {item.agent.name || item.agent.email}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.agent.role.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {item.totalCalls}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.totalCommunications}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.assignedLeads}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.completedTasks}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
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
