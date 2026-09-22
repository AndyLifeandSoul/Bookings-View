"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { saveTables, removeTable, type TableRowInput } from "./actions";

/**
 * Inline-editable tables grid, DMN-style: every table is a row you edit in
 * place (label, zone, min/max covers, active), drag to reorder, add or
 * remove inline, and one Save, instead of a separate edit page per table.
 * Local edits are buffered until Save; a per-row remove is immediate
 * (deletion has its own booking-safety rule server-side). After any server
 * write it refreshes and re-seeds from the authoritative data.
 */

export interface GridTable {
  id: string;
  label: string;
  areaId: string | null;
  minCovers: number;
  maxCovers: number;
  active: boolean;
}

interface Row {
  key: string;
  id: string | null;
  label: string;
  areaId: string;
  minCovers: string;
  maxCovers: string;
  active: boolean;
}

let tempCounter = 0;

function toRow(t: GridTable): Row {
  return {
    key: t.id,
    id: t.id,
    label: t.label,
    areaId: t.areaId ?? "",
    minCovers: String(t.minCovers),
    maxCovers: String(t.maxCovers),
    active: t.active,
  };
}

function GridRow({
  row,
  areas,
  onPatch,
  onRemove,
}: {
  row: Row;
  areas: { id: string; name: string }[];
  onPatch: (change: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 border-b border-zinc-50 bg-white px-2 py-2 last:border-0 ${isDragging ? "[box-shadow:var(--shadow-md)]" : ""}`}
    >
      <button
        type="button"
        className="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" strokeWidth={2} />
      </button>
      <input
        type="text"
        value={row.label}
        onChange={(e) => onPatch({ label: e.target.value })}
        placeholder="Table name"
        className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      />
      <select
        value={row.areaId}
        onChange={(e) => onPatch({ areaId: e.target.value })}
        className="w-36 shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      >
        <option value="">No zone</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        value={row.minCovers}
        onChange={(e) => onPatch({ minCovers: e.target.value })}
        aria-label="Min covers"
        className="w-16 shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm tabular-nums"
      />
      <input
        type="number"
        min={1}
        value={row.maxCovers}
        onChange={(e) => onPatch({ maxCovers: e.target.value })}
        aria-label="Max covers"
        className="w-16 shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm tabular-nums"
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600">
        <input type="checkbox" checked={row.active} onChange={(e) => onPatch({ active: e.target.checked })} className="h-4 w-4 rounded border-zinc-300" />
        Active
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove table"
        className="flex w-7 shrink-0 items-center justify-center text-zinc-300 transition-colors hover:text-[var(--danger)]"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function TablesGrid({
  venueId,
  areas,
  tables,
}: {
  venueId: string;
  areas: { id: string; name: string }[];
  tables: GridTable[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => tables.map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Re-seed from the server after a write refreshes the page data.
  const [seen, setSeen] = useState(tables);
  if (seen !== tables) {
    setSeen(tables);
    setRows(tables.map(toRow));
    setError(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((cur) => {
      const oldIndex = cur.findIndex((r) => r.key === active.id);
      const newIndex = cur.findIndex((r) => r.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return cur;
      return arrayMove(cur, oldIndex, newIndex);
    });
  }

  function patch(key: string, change: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  function addRow() {
    tempCounter += 1;
    setRows((cur) => [
      ...cur,
      { key: `new-${tempCounter}`, id: null, label: "", areaId: "", minCovers: "2", maxCovers: "4", active: true },
    ]);
  }

  function removeRow(row: Row) {
    if (!row.id) {
      setRows((cur) => cur.filter((r) => r.key !== row.key));
      return;
    }
    startTransition(async () => {
      const result = await removeTable(venueId, row.id!);
      setError(result?.error ?? null);
      router.refresh();
    });
  }

  function save() {
    setError(null);
    const payload: TableRowInput[] = rows.map((r) => ({
      id: r.id,
      label: r.label,
      areaId: r.areaId || null,
      minCovers: Number(r.minCovers),
      maxCovers: Number(r.maxCovers),
      active: r.active,
    }));
    startTransition(async () => {
      const result = await saveTables(venueId, payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white [box-shadow:var(--shadow-sm)]">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <span className="w-6 shrink-0" />
          <span className="min-w-0 flex-1">Table</span>
          <span className="w-36 shrink-0">Zone</span>
          <span className="w-16 shrink-0">Min</span>
          <span className="w-16 shrink-0">Max</span>
          <span className="w-[4.5rem] shrink-0" />
          <span className="w-7 shrink-0" />
        </div>

        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">No tables yet. Add one below.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
              <div>
                {rows.map((row) => (
                  <GridRow
                    key={row.key}
                    row={row}
                    areas={areas}
                    onPatch={(change) => patch(row.key, change)}
                    onRemove={() => removeRow(row)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={addRow} className={buttonStyles("secondary", "sm")}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add table
        </button>
        <button type="button" onClick={save} disabled={pending} className={buttonStyles("primary", "md")}>
          {pending ? "Saving…" : "Save tables"}
        </button>
      </div>
    </div>
  );
}
