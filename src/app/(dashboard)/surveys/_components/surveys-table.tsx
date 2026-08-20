"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  PencilIcon,
  Trash2,
  MoreHorizontal,
  ToggleLeft,
  ToggleRight,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteSurvey, toggleSurveyActive } from "@/actions/survey.actions";
import { formatDate } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface Survey {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    questions: number;
    responses: number;
  };
}

interface SurveysTableProps {
  data: Survey[];
}

// ============================================================
// Surveys Table Component
// ============================================================

export function SurveysTable({ data }: SurveysTableProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this survey?")) return;
    setLoading(id);
    const result = await deleteSurvey(id);
    setLoading(null);
    if (result.success) {
      toast.success("Survey deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggle(id: string) {
    setLoading(id);
    const result = await toggleSurveyActive(id);
    setLoading(null);
    if (result.success) {
      toast.success(
        result.data.isActive ? "Survey activated" : "Survey deactivated"
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12">
        <p className="text-sm font-medium text-muted-foreground">No surveys yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first survey to start collecting feedback.
        </p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/surveys/new">Create Survey</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200/80 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="text-center">Questions</TableHead>
            <TableHead className="text-center">Responses</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((survey) => (
            <TableRow key={survey.id}>
              <TableCell>
                <Link
                  href={`/surveys/${survey.id}`}
                  className="font-medium text-foreground hover:text-indigo-600 transition-colors"
                >
                  {survey.title}
                </Link>
                {survey.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {survey.description}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="text-xs">
                  {survey._count.questions}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="text-xs">
                  {survey._count.responses}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={
                    survey.isActive
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  }
                >
                  {survey.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(survey.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={loading === survey.id}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/surveys/${survey.id}`}>
                        <Eye className="mr-2 size-4" />
                        View Results
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/surveys/${survey.id}/edit`}>
                        <PencilIcon className="mr-2 size-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(survey.id)}>
                      {survey.isActive ? (
                        <>
                          <ToggleLeft className="mr-2 size-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className="mr-2 size-4" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/portal/surveys/${survey.id}`
                        );
                        toast.success("Survey link copied to clipboard");
                      }}
                    >
                      <Send className="mr-2 size-4" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(survey.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
