"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SlidersHorizontalIcon,
  SearchIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// DataTable Props
// ============================================================

/**
 * Rows-per-page choices.
 *
 * Every list in this app was fixed at 10, so 24 leads meant three pages of
 * clicking to see a book that fits on one screen. The server already sends up
 * to 500 rows to these tables, so the larger sizes cost nothing extra — they
 * page through data that is ALREADY in the browser.
 *
 * 500 is the ceiling deliberately: it matches the server-side fetch ceiling, so
 * the selector can never promise more rows than were actually loaded.
 */
const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 300, 400, 500] as const;

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  toolbarExtra?: React.ReactNode;
  enableRowSelection?: boolean;
  onSelectionChange?: (selectedRows: TData[]) => void;
  getRowId?: (row: TData) => string;
  /**
   * Below `md`, render each row as a stacked card instead of a table row.
   * Defaults ON so all ~50 tables in the app become usable on a phone without
   * touching a single call site — side-scrolling a 12-column table on a 375px
   * screen is the worst offender in the whole UI. Opt out only where a table is
   * already narrow enough (2–3 columns) that the grid reads fine as-is.
   */
  mobileCards?: boolean;
  /** Starting rows-per-page. Stays 10 so no existing table changes behaviour. */
  defaultPageSize?: number;
}

// ============================================================
// Mobile card helpers
// ============================================================

/** Columns that are chrome, not data — they get their own slot on the card. */
const STRUCTURAL_COLUMN_IDS = new Set(["select", "actions"]);

/** "eventDate" / "event_date" -> "Event Date". Same convention the Columns
 *  visibility menu already uses, so labels read identically in both places. */
function prettifyColumnId(id: string): string {
  return id
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * The label to print above a value on a mobile card.
 *
 * We deliberately do NOT render the column's `header`: it is usually a
 * `DataTableColumnHeader` element (a sort button), which makes no sense as a
 * card label. So: an explicit `meta.label` wins, a plain-string header is used
 * verbatim, and everything else falls back to a prettified column id. That
 * keeps the card derivation automatic for every existing caller.
 */
function mobileLabelFor(column: {
  id: string;
  columnDef: { header?: unknown; meta?: unknown };
}): string {
  const meta = column.columnDef.meta as { label?: string } | undefined;
  if (meta?.label) return meta.label;
  const header = column.columnDef.header;
  if (typeof header === "string" && header.trim()) return header;
  return prettifyColumnId(column.id);
}

// ============================================================
// Selection Column Helper
// ============================================================

export function getSelectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

// ============================================================
// DataTable Component
// ============================================================

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  toolbarExtra,
  enableRowSelection = false,
  onSelectionChange,
  getRowId,
  mobileCards = true,
  defaultPageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    ...(getRowId && { getRowId }),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  // Notify parent of selection changes
  React.useEffect(() => {
    if (enableRowSelection && onSelectionChange) {
      const selected = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original);
      onSelectionChange(selected);
    }
  }, [rowSelection, enableRowSelection, onSelectionChange, table]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {searchKey && (
            <div className="relative w-full max-w-sm flex-1">
              <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  (table
                    .getColumn(searchKey)
                    ?.getFilterValue() as string) ?? ""
                }
                onChange={(event) =>
                  table
                    .getColumn(searchKey)
                    ?.setFilterValue(event.target.value)
                }
                className="pl-9"
              />
            </div>
          )}
        </div>

        {/* Right-side controls — wrap on mobile instead of overflowing */}
        <div className="flex flex-wrap items-center gap-2">
        {/* Extra toolbar content (e.g. Export button) */}
        {toolbarExtra}

        {/* Column Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontalIcon className="mr-2 size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) =>
                    column.toggleVisibility(!!value)
                  }
                >
                  {column.id.replace(/([A-Z])/g, " $1").trim()}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Mobile (below md) — one card per row.
          A wide table can only be read by side-scrolling on a phone, which is
          the single most "broken-feeling" thing in the app. The card is derived
          from the SAME visible TanStack columns: first data column = heading,
          the rest = label/value pairs, with select + actions kept in the
          card chrome. Automatic for every caller; `mobileCards={false}` opts
          a narrow table back into the plain grid. */}
      {mobileCards && (
        <div className="space-y-2.5 md:hidden">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const cells = row.getVisibleCells();
              const selectCell = cells.find((c) => c.column.id === "select");
              const actionsCell = cells.find((c) => c.column.id === "actions");
              const dataCells = cells.filter(
                (c) => !STRUCTURAL_COLUMN_IDS.has(c.column.id)
              );
              const [primaryCell, ...detailCells] = dataCells;

              return (
                <div
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="rounded-xl border border-border bg-card p-3.5 shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-colors data-[state=selected]:border-primary/40 data-[state=selected]:bg-primary/[0.04]"
                >
                  <div className="flex items-start gap-3">
                    {selectCell && (
                      <div className="shrink-0 pt-0.5">
                        {flexRender(
                          selectCell.column.columnDef.cell,
                          selectCell.getContext()
                        )}
                      </div>
                    )}
                    {primaryCell && (
                      <div className="min-w-0 flex-1 text-copy font-semibold leading-snug text-foreground">
                        {flexRender(
                          primaryCell.column.columnDef.cell,
                          primaryCell.getContext()
                        )}
                      </div>
                    )}
                    {/* Row actions stay in the top-right corner — thumb-side
                        and in the same place on every card. */}
                    {actionsCell && (
                      <div className="-mr-1.5 -mt-1.5 shrink-0">
                        {flexRender(
                          actionsCell.column.columnDef.cell,
                          actionsCell.getContext()
                        )}
                      </div>
                    )}
                  </div>

                  {detailCells.length > 0 && (
                    // Two columns at 375px gives ~155px per field — enough for
                    // dates, amounts and status pills. Label sits ABOVE the
                    // value (not beside it) so arbitrary cell renderers
                    // (avatars, pills, multi-line) don't have to fit a
                    // right-aligned slot.
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/60 pt-3">
                      {detailCells.map((cell) => (
                        <div key={cell.id} className="min-w-0">
                          <dt className="text-meta font-medium uppercase tracking-[0.05em] text-muted-foreground">
                            {mobileLabelFor(cell.column)}
                          </dt>
                          <dd className="mt-0.5 text-body leading-snug text-foreground">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-body text-muted-foreground">
              No results.
            </div>
          )}
        </div>
      )}

      {/* Table — clip the rounded corners but let wide tables scroll inside
          their own box instead of overflowing the page (and sliding under the
          sidebar when it collapses). Hidden below md when the card view is on;
          desktop rendering is unchanged. */}
      <div
        className={cn(
          "rounded-lg border border-border bg-card overflow-x-auto",
          mobileCards && "hidden md:block"
        )}
      >
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-border hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 px-3 text-meta font-medium uppercase tracking-[0.05em] text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group/row border-b border-border last:border-0 transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/[0.04]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-body text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — wraps at 375px instead of pushing the page sideways
          (four 44px touch targets + two labels do not fit on one phone line). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-detail text-muted-foreground">
        <div>
          {enableRowSelection && Object.keys(rowSelection).length > 0 ? (
            <span>
              <span className="font-medium text-foreground tabular-nums">{Object.keys(rowSelection).length}</span> of{" "}
              <span className="tabular-nums">{table.getFilteredRowModel().rows.length}</span> selected
            </span>
          ) : (
            <span>
              <span className="font-medium text-foreground tabular-nums">{table.getFilteredRowModel().rows.length}</span> result
              {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/*
            Rows per page. Sits beside the page counter because that is where
            someone looks the moment they realise "Page 1 of 3" is standing
            between them and 24 records.

            Changing size jumps back to the first page on purpose: keeping
            pageIndex while the page grows can land you past the end and show an
            empty table, which reads as data loss rather than a resize.
          */}
          <label className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-muted-foreground">Rows</span>
            <select
              aria-label="Rows per page"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
                table.setPageIndex(0);
              }}
              className="h-7 rounded-md border border-border bg-card px-1.5 text-detail tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </div>
          <div className="flex items-center gap-0.5">
            {/* First/last page are a nicety on desktop; on a phone they just
                eat two 44px slots next to the prev/next people actually use. */}
            <Button
              variant="ghost"
              size="icon-xs"
              className="hidden size-7 text-muted-foreground sm:inline-flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeftIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="hidden size-7 text-muted-foreground sm:inline-flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sortable Header Helper
// ============================================================

import { type Column } from "@tanstack/react-table";
import { ArrowUpDownIcon } from "lucide-react";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  return (
    <button
      type="button"
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-meta font-medium uppercase tracking-[0.05em] text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDownIcon className="size-3 opacity-60" />
    </button>
  );
}
