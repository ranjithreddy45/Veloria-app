"use client";

import * as React from "react";
import { ArrowRightIcon, FileTextIcon, ZapIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface Transition {
  id: string;
  fromStatus: string;
  toStatus: string;
  name: string | null;
  requiredFields: unknown;
  requiredActions: unknown;
  allowedRoles: string[];
  isActive: boolean;
  order: number;
}

interface TransitionMapProps {
  entityType: string;
  transitions: Transition[];
}

// ============================================================
// Status Definitions by Entity Type
// ============================================================

interface StatusNode {
  value: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const LEAD_STATUSES: StatusNode[] = [
  {
    value: "NEW",
    label: "New",
    color: "text-foreground/80",
    bgColor: "bg-muted",
    borderColor: "border-border",
  },
  {
    value: "CONTACTED",
    label: "Contacted",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  },
  {
    value: "QUALIFIED",
    label: "Qualified",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
  {
    value: "PROPOSAL_SENT",
    label: "Proposal Sent",
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-300",
  },
  {
    value: "NEGOTIATION",
    label: "Negotiation",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
  {
    value: "WON",
    label: "Won",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
  },
  {
    value: "LOST",
    label: "Lost",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
  },
];

const BOOKING_STATUSES: StatusNode[] = [
  {
    value: "HOLD",
    label: "Hold",
    color: "text-foreground/80",
    bgColor: "bg-muted",
    borderColor: "border-border",
  },
  {
    value: "TENTATIVE",
    label: "Tentative",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  },
  {
    value: "CONFIRMED",
    label: "Confirmed",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
  {
    value: "COMPLETED",
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
  },
];

// ============================================================
// Helpers
// ============================================================

function getStatusNodes(entityType: string): StatusNode[] {
  if (entityType === "LEAD") return LEAD_STATUSES;
  if (entityType === "BOOKING") return BOOKING_STATUSES;
  return [];
}

function getTransitionsBetween(
  transitions: Transition[],
  from: string,
  to: string
): Transition[] {
  return transitions.filter((t) => t.fromStatus === from && t.toStatus === to);
}

function getOutgoingTransitions(
  transitions: Transition[],
  from: string
): Transition[] {
  return transitions.filter((t) => t.fromStatus === from);
}

function getRequirementCount(transition: Transition): number {
  const fields = (transition.requiredFields as string[]) ?? [];
  const actions = (transition.requiredActions as string[]) ?? [];
  return fields.length + actions.length;
}

// ============================================================
// TransitionMap Component
// ============================================================

export function TransitionMap({ entityType, transitions }: TransitionMapProps) {
  const statusNodes = getStatusNodes(entityType);

  // For DEAL entity type, we don't have predefined statuses
  if (statusNodes.length === 0) {
    return (
      <section className="rounded-2xl border bg-card shadow-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
            Transition Map
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            The visual map covers Lead and Booking blueprints. Deals use dynamic
            pipeline stages, so their transitions are listed rather than drawn.
          </p>
        </div>
        <div className="px-5 py-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            <span className="numeric font-medium text-foreground">
              {transitions.length}
            </span>{" "}
            transition{transitions.length !== 1 ? "s" : ""} defined — see the
            table below.
          </p>
        </div>
      </section>
    );
  }

  // Determine the main flow and terminal states
  const mainFlow = entityType === "LEAD"
    ? ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"]
    : ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS"];

  const terminalStates = entityType === "LEAD"
    ? ["WON", "LOST"]
    : ["COMPLETED", "CANCELLED"];

  const mainNodes = statusNodes.filter((s) => mainFlow.includes(s.value));
  const terminalNodes = statusNodes.filter((s) =>
    terminalStates.includes(s.value)
  );

  return (
    <section className="rounded-2xl border bg-card shadow-card">
      <div className="border-b px-5 py-4">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
          Transition Map
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every legal status change at a glance. Arrows show which way a record
          is allowed to move.
        </p>
      </div>
      <div className="px-5 py-5">
        <div className="space-y-6">
          {/* Main Flow */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {mainNodes.map((node, index) => {
              const outgoing = getOutgoingTransitions(transitions, node.value);
              const hasNextTransition =
                index < mainNodes.length - 1 &&
                getTransitionsBetween(
                  transitions,
                  node.value,
                  mainNodes[index + 1].value
                ).length > 0;

              return (
                <React.Fragment key={node.value}>
                  <StatusNodeBox
                    node={node}
                    outgoingCount={outgoing.length}
                    entityType={entityType}
                    transitions={transitions}
                  />
                  {index < mainNodes.length - 1 && (
                    <div className="flex flex-col items-center min-w-[40px]">
                      <ArrowRightIcon
                        className={cn(
                          "size-5",
                          hasNextTransition
                            ? "text-primary"
                            : "text-muted-foreground/30"
                        )}
                      />
                      {hasNextTransition && (
                        <TransitionLabel
                          transitions={getTransitionsBetween(
                            transitions,
                            node.value,
                            mainNodes[index + 1].value
                          )}
                        />
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Terminal States */}
          {terminalNodes.length > 0 && (
            <div className="flex items-center justify-center gap-6 pt-2 border-t border-dashed">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Terminal States
              </span>
              {terminalNodes.map((node) => {
                const incoming = transitions.filter(
                  (t) => t.toStatus === node.value
                );
                return (
                  <StatusNodeBox
                    key={node.value}
                    node={node}
                    outgoingCount={0}
                    incomingCount={incoming.length}
                    entityType={entityType}
                    transitions={transitions}
                  />
                );
              })}
            </div>
          )}

          {/* Non-sequential transitions */}
          <NonSequentialTransitions
            transitions={transitions}
            mainFlow={mainFlow}
            terminalStates={terminalStates}
            entityType={entityType}
            statusNodes={statusNodes}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// StatusNodeBox Component
// ============================================================

function StatusNodeBox({
  node,
  outgoingCount,
  incomingCount,
  entityType,
  transitions,
}: {
  node: StatusNode;
  outgoingCount: number;
  incomingCount?: number;
  entityType: string;
  transitions: Transition[];
}) {
  const outgoing = getOutgoingTransitions(transitions, node.value);
  const totalRequirements = outgoing.reduce(
    (sum, t) => sum + getRequirementCount(t),
    0
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 min-w-[110px] transition-colors",
        node.bgColor,
        node.borderColor
      )}
    >
      <span className={cn("text-sm font-semibold", node.color)}>
        {node.label}
      </span>
      <div className="flex items-center gap-1.5">
        {outgoingCount > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {outgoingCount} out
          </Badge>
        )}
        {(incomingCount ?? 0) > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {incomingCount} in
          </Badge>
        )}
      </div>
      {totalRequirements > 0 && (
        <div className="absolute -top-2 -right-2">
          <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white hover:bg-amber-600">
            {totalRequirements}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TransitionLabel Component
// ============================================================

function TransitionLabel({ transitions }: { transitions: Transition[] }) {
  if (transitions.length === 0) return null;

  const t = transitions[0];
  const reqFields = (t.requiredFields as string[]) ?? [];
  const reqActions = (t.requiredActions as string[]) ?? [];

  return (
    <div className="flex flex-col items-center gap-0.5 mt-1">
      {t.name && (
        <span className="text-[10px] text-muted-foreground font-medium text-center max-w-[80px] truncate">
          {t.name}
        </span>
      )}
      <div className="flex items-center gap-1">
        {reqFields.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-warning">
            <FileTextIcon className="size-2.5" />
            {reqFields.length}
          </span>
        )}
        {reqActions.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-purple-600">
            <ZapIcon className="size-2.5" />
            {reqActions.length}
          </span>
        )}
      </div>
      {!t.isActive && (
        <span className="text-[9px] text-destructive font-medium">INACTIVE</span>
      )}
    </div>
  );
}

// ============================================================
// Non-Sequential Transitions
// ============================================================
// Shows transitions that skip steps or go backwards.

function NonSequentialTransitions({
  transitions,
  mainFlow,
  terminalStates,
  entityType,
  statusNodes,
}: {
  transitions: Transition[];
  mainFlow: string[];
  terminalStates: string[];
  entityType: string;
  statusNodes: StatusNode[];
}) {
  // Find transitions that are not sequential main flow transitions
  const nonSequential = transitions.filter((t) => {
    const fromIdx = mainFlow.indexOf(t.fromStatus);
    const toIdx = mainFlow.indexOf(t.toStatus);

    // Sequential main flow transition
    if (fromIdx >= 0 && toIdx >= 0 && toIdx === fromIdx + 1) return false;

    // Terminal transitions are expected
    if (terminalStates.includes(t.toStatus)) return false;

    return true;
  });

  // Also include transitions to terminal states
  const toTerminal = transitions.filter((t) =>
    terminalStates.includes(t.toStatus)
  );

  const allSpecial = [...nonSequential, ...toTerminal];

  if (allSpecial.length === 0) return null;

  const getStatusLabel = (status: string): string => {
    const node = statusNodes.find((s) => s.value === status);
    return node?.label ?? status;
  };

  return (
    <div className="space-y-2 pt-2 border-t border-dashed">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        All Defined Transitions
      </p>
      <div className="flex flex-wrap gap-2">
        {allSpecial.map((t) => {
          const reqFields = (t.requiredFields as string[]) ?? [];
          const reqActions = (t.requiredActions as string[]) ?? [];
          const reqCount = reqFields.length + reqActions.length;

          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
                t.isActive
                  ? "bg-background border-border"
                  : "bg-muted/50 border-muted text-muted-foreground"
              )}
            >
              <span className="font-medium">
                {getStatusLabel(t.fromStatus)}
              </span>
              <ArrowRightIcon className="size-3 text-muted-foreground" />
              <span className="font-medium">
                {getStatusLabel(t.toStatus)}
              </span>
              {t.name && (
                <span className="text-muted-foreground">({t.name})</span>
              )}
              {reqCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 ml-1"
                >
                  {reqCount} req
                </Badge>
              )}
              {!t.isActive && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  Off
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
