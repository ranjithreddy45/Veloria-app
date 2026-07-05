"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SearchIcon,
  LayoutGridIcon,
  TableIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  GlobeIcon,
  MapPinIcon,
  PlusIcon,
  BarChart3Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMPETITOR_RATING_COLORS } from "@/lib/constants";
import { deleteCompetitor } from "@/actions/competitor.actions";
import { CompetitorFormDialog } from "./competitor-form-dialog";
import { CompetitorComparison } from "./competitor-comparison";

// ============================================================
// Types
// ============================================================

interface CompetitorData {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  venueTypes: string[];
  priceRange: string | null;
  rating: number | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

interface CompetitorListProps {
  data: CompetitorData[];
}

// ============================================================
// Star Rating Display
// ============================================================

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) {
    return <span className="text-muted-foreground text-sm">--</span>;
  }

  const colorClass = COMPETITOR_RATING_COLORS[rating] ?? "text-yellow-500";

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon
            key={i}
            className={`size-4 ${
              i < rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-muted text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className={`text-sm font-semibold ${colorClass}`}>
        {rating}
      </span>
    </div>
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({
  competitor,
  onEdit,
}: {
  competitor: CompetitorData;
  onEdit: (competitor: CompetitorData) => void;
}) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteCompetitor(competitor.id);
    if (result.success) {
      toast.success("Competitor deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(competitor)}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive">
              <TrashIcon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Competitor</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{competitor.name}</span>? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// Competitor Card View
// ============================================================

function CompetitorCard({
  competitor,
  onEdit,
}: {
  competitor: CompetitorData;
  onEdit: (competitor: CompetitorData) => void;
}) {
  return (
    <Card className="relative gap-0 py-0">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold tracking-[-0.01em]">
              {competitor.name}
            </CardTitle>
            {competitor.location && (
              <div className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                <MapPinIcon className="size-3.5" />
                {competitor.location}
              </div>
            )}
          </div>
          <ActionsCell competitor={competitor} onEdit={onEdit} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {/* Rating */}
        <RatingStars rating={competitor.rating} />

        {/* Website */}
        {competitor.website && (
          <div className="flex items-center gap-1.5 text-sm">
            <GlobeIcon className="size-3.5 text-muted-foreground" />
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400 truncate"
            >
              {competitor.website}
            </a>
          </div>
        )}

        {/* Venue Types */}
        {competitor.venueTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {competitor.venueTypes.map((type) => (
              <Badge key={type} variant="secondary" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        )}

        {/* Price Range */}
        {competitor.priceRange && (
          <div className="text-sm">
            <span className="text-muted-foreground">Price Range: </span>
            <span className="font-medium">{competitor.priceRange}</span>
          </div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid gap-3">
          {competitor.strengths && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                Strengths
              </p>
              <p className="text-sm text-emerald-800 dark:text-emerald-300 whitespace-pre-line">
                {competitor.strengths}
              </p>
            </div>
          )}
          {competitor.weaknesses && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                Weaknesses
              </p>
              <p className="text-sm text-rose-800 dark:text-rose-300 whitespace-pre-line">
                {competitor.weaknesses}
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {competitor.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {competitor.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// CompetitorList Component
// ============================================================

export function CompetitorList({ data }: CompetitorListProps) {
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<"cards" | "table" | "comparison">("cards");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingCompetitor, setEditingCompetitor] = React.useState<CompetitorData | undefined>(
    undefined
  );

  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.venueTypes.some((v) => v.toLowerCase().includes(q)) ||
        c.notes?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const handleEdit = (competitor: CompetitorData) => {
    setEditingCompetitor(competitor);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingCompetitor(undefined);
    setFormOpen(true);
  };

  const handleDialogClose = () => {
    setFormOpen(false);
    setEditingCompetitor(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search competitors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "cards" | "table" | "comparison")}
          >
            <TabsList>
              <TabsTrigger value="cards" className="gap-1.5">
                <LayoutGridIcon className="size-4" />
                <span className="hidden sm:inline">Cards</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5">
                <TableIcon className="size-4" />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
              <TabsTrigger value="comparison" className="gap-1.5">
                <BarChart3Icon className="size-4" />
                <span className="hidden sm:inline">Compare</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleAdd} size="sm">
            <PlusIcon className="mr-1.5 size-4" />
            Add Competitor
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3Icon className="size-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              No competitors found
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Try adjusting your search query."
                : "Add your first competitor to start tracking the competition."}
            </p>
            {!search && (
              <Button onClick={handleAdd} size="sm" className="mt-4">
                <PlusIcon className="mr-1.5 size-4" />
                Add Competitor
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card View */}
      {view === "cards" && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((competitor) => (
            <CompetitorCard
              key={competitor.id}
              competitor={competitor}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Table View */}
      {view === "table" && filtered.length > 0 && (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead>Venue Types</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((competitor) => (
                <TableRow key={competitor.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{competitor.name}</p>
                      {competitor.website && (
                        <a
                          href={competitor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {competitor.website}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {competitor.location || "--"}
                  </TableCell>
                  <TableCell>
                    <RatingStars rating={competitor.rating} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {competitor.priceRange || "--"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {competitor.venueTypes.length > 0
                        ? competitor.venueTypes.map((type) => (
                            <Badge
                              key={type}
                              variant="secondary"
                              className="text-xs"
                            >
                              {type}
                            </Badge>
                          ))
                        : "--"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ActionsCell competitor={competitor} onEdit={handleEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Comparison View */}
      {view === "comparison" && filtered.length > 0 && (
        <CompetitorComparison data={filtered} />
      )}

      {/* Form Dialog */}
      <CompetitorFormDialog
        open={formOpen}
        onOpenChange={handleDialogClose}
        competitor={editingCompetitor}
      />
    </div>
  );
}
