/**
 * The order tables are shown in everywhere staff see them (diary, floor
 * plan, booking forms, Tables & Areas): the order set by dragging on the
 * Tables & Areas page (Table.sortOrder), and within the same sortOrder (a
 * venue that has never reordered, where every table is 0) the way a human
 * reads labels, T1, T2 ... T10, T11, rather than plain string order (which
 * puts "T10" before "T2").
 *
 * Area is deliberately not part of the order. Ordering by area priority
 * put every unassigned-area table (sorted NULLS LAST by Postgres) at the
 * very bottom regardless of its own label, the bug behind "I removed T1
 * from Ground Floor and it dropped to the bottom of the list". Venues that
 * want tables grouped by area drag them into that order.
 *
 * Intl.Collator's `numeric: true` option does the natural-sort work
 * (comparing embedded digit runs as numbers, not characters), so "T20 A"
 * correctly sorts before "T20 B" and after "T9".
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function naturalSortTables<T extends { label: string; sortOrder: number }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => a.sortOrder - b.sortOrder || collator.compare(a.label, b.label));
}
