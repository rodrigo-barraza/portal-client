"use client";

import { useMemo, useState } from "react";

/**
 * Controlled sorting for a library TableComponent. Left to itself the
 * table sorts by its FIRST column ascending — a ranked report (top pages
 * by views) would open alphabetized. This keeps the rank order until a
 * header is clicked, and a newly clicked numeric column starts at its
 * largest value.
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDirection;
}

export interface SortableColumn<Row> {
  key: string;
  sortValue?: (row: Row) => string | number;
}

/** `rows` ordered by `sort`'s column (stable); unchanged for an unknown column. */
export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly SortableColumn<Row>[],
  sort: SortState,
): Row[] {
  const value = columns.find((column) => column.key === sort.key)?.sortValue;
  if (!value) return [...rows];
  const direction = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: value(row) }))
    .sort((first, second) => {
      const order =
        typeof first.key === "string" && typeof second.key === "string"
          ? first.key.localeCompare(second.key)
          : Number(first.key) - Number(second.key);
      return order * direction || first.index - second.index;
    })
    .map(({ row }) => row);
}

export default function useTableSort<Row>(
  rows: readonly Row[],
  columns: readonly SortableColumn<Row>[],
  initial: SortState,
) {
  const [sort, setSort] = useState<SortState>(initial);
  const sorted = useMemo(
    () => sortRows(rows, columns, sort),
    [rows, columns, sort],
  );

  const onSort = (key: string, dir: SortDirection) => {
    if (key === sort.key) return setSort({ key, dir });
    // A new column: text reads A→Z, numbers biggest first
    const sample = rows[0];
    const value = columns.find((column) => column.key === key)?.sortValue;
    const isText = sample !== undefined && typeof value?.(sample) === "string";
    setSort({ key, dir: isText ? "asc" : "desc" });
  };

  return { rows: sorted, sortKey: sort.key, sortDir: sort.dir, onSort };
}
