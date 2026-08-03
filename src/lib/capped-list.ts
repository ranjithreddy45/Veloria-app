import type { Prisma } from "@prisma/client";

// ============================================================
// Reading a capped list WITHOUT lying about it.
//
// The recurring bug this exists to end: a list query says `take: 500`, returns
// a bare array, and the screen renders it as though it were everything. Past
// the cap the page quietly shows a subset while a dashboard counts the whole
// table — and the two screens look like they disagree for no visible reason.
// A cap that does not announce itself reads as "this is all of it".
//
// So the count is not optional here. `cappedList` fetches the rows and the true
// total together and hands back both, which makes the honest version the
// EASIEST version to write — the only way to forget the total is to go around
// this helper deliberately.
//
// It is not a paginator. Use it for the browse-everything lists (boards,
// inboxes, registers) that intentionally load one big page; anything the user
// pages through should return page/limit/totalPages instead.
// ============================================================

export interface CappedListResult<T> {
  /** The rows actually loaded — at most `limit` of them. */
  rows: T[];
  /** How many rows exist in total, ignoring the cap. */
  total: number;
  /** True when rows were left behind. The UI must say so when this is true. */
  truncated: boolean;
  /** The cap that was applied, so the UI can name it. */
  limit: number;
}

/**
 * Run a findMany and its matching count as one unit.
 *
 * `findMany` and `count` MUST be given the same `where`, or the notice will lie
 * in the other direction. Passing the delegate and the args separately (rather
 * than two prepared queries) is what keeps them in step.
 */
export async function cappedList<T>(
  delegate: {
    findMany: (args: unknown) => Promise<T[]>;
    count: (args: { where?: unknown }) => Promise<number>;
  },
  args: { where?: unknown } & Record<string, unknown>,
  limit: number
): Promise<CappedListResult<T>> {
  const [rows, total] = await Promise.all([
    delegate.findMany({ ...args, take: limit }),
    delegate.count({ where: args.where }),
  ]);
  return { rows, total, truncated: total > rows.length, limit };
}

/**
 * The sentence a capped list should show. Returns null when nothing was
 * dropped, so a caller can render it unconditionally and get silence in the
 * common case.
 */
export function truncationNotice(
  result: Pick<CappedListResult<unknown>, "rows" | "total" | "truncated">,
  noun: string,
  orderedBy = "most recently updated"
): string | null {
  if (!result.truncated) return null;
  return `Showing the ${result.rows.length} ${orderedBy} of ${result.total} ${noun}.`;
}

/** Prisma's `where` types vary per model; this keeps call sites readable. */
export type AnyWhere = Prisma.InputJsonValue | Record<string, unknown> | undefined;
