import { describe, it, expect } from "vitest";
import { sortRows } from "../useTableSort";

interface Row {
  path: string;
  views: number;
}

const rows: Row[] = [
  { path: "/b", views: 5 },
  { path: "/a", views: 9 },
  { path: "/c", views: 5 },
];
const columns = [
  { key: "path", sortValue: (row: Row) => row.path },
  { key: "views", sortValue: (row: Row) => row.views },
  { key: "note" },
];

describe("sortRows", () => {
  it("sorts numbers either way, keeping ties in their ranked order", () => {
    expect(
      sortRows(rows, columns, { key: "views", dir: "desc" }).map(
        (row) => row.path,
      ),
    ).toEqual(["/a", "/b", "/c"]);
    expect(
      sortRows(rows, columns, { key: "views", dir: "asc" }).map(
        (row) => row.path,
      ),
    ).toEqual(["/b", "/c", "/a"]);
  });

  it("sorts text alphabetically", () => {
    expect(
      sortRows(rows, columns, { key: "path", dir: "asc" }).map(
        (row) => row.path,
      ),
    ).toEqual(["/a", "/b", "/c"]);
  });

  it("leaves the order alone for a column without a sort value", () => {
    expect(sortRows(rows, columns, { key: "note", dir: "asc" })).toEqual(rows);
    expect(sortRows(rows, columns, { key: "nope", dir: "asc" })).toEqual(rows);
  });

  it("never reorders the array it was given", () => {
    const copy = [...rows];
    sortRows(rows, columns, { key: "path", dir: "desc" });
    expect(rows).toEqual(copy);
  });
});
