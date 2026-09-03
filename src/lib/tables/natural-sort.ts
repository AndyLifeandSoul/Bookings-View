/**
 * Sorts tables the way a human reads their labels — T1, T2, T3, ... T10,
 * T11 — rather than plain string order (which puts "T10" before "T2") or
 * Prisma's `orderBy: { area: { priority: "asc" } }` (which puts every
 * unassigned-area table, sorted NULLS LAST by Postgres, at the very bottom
 * regardless of its own label — the bug behind "I removed T1 from Ground
 * Floor and it dropped to the bottom of the list"). Deliberately ignores
 * area and sortOrder entirely: DV8's real numbering already runs roughly
 * area-by-area (T1-T2 Bar, T3-T7 Downstairs, T8-T26 Upstairs, T30-T42
 * Outside, T50-T55 Shop), so a pure natural sort on the label keeps that
 * grouping for free while also being stable across area reassignment.
 *
 * Intl.Collator's `numeric: true` option does the actual natural-sort work
 * (comparing embedded digit runs as numbers, not characters), so "T20 A"
 * correctly sorts before "T20 B" and after "T9".
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function naturalSortTables<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => collator.compare(a.label, b.label));
}
