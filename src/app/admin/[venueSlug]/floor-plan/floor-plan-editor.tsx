"use client";

import { useState, useTransition } from "react";
import { AreaTabs, FloorCanvas, PLAN_H, PLAN_W, defaultSize, useAreaTabs, type PlanTable } from "@/components/floor-plan";
import { buttonStyles } from "@/components/ui/button";
import { saveFloorPlan } from "./actions";

/**
 * Drag-and-drop floor plan, one area at a time. Tap a table in the tray to
 * drop it on the plan, drag to move, and use the bar under the plan to
 * change the selected table's shape, size or angle. Nothing is saved until
 * "Save floor plan".
 */
export function FloorPlanEditor({ venueId, areas, initial }: { venueId: string; areas: { id: string; name: string }[]; initial: PlanTable[] }) {
  const [tables, setTables] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { tabs, active, setActive } = useAreaTabs(tables, areas);
  const inArea = tables.filter((t) => t.areaId === active);
  const unplaced = inArea.filter((t) => t.x == null);
  const sel = tables.find((t) => t.id === selected) ?? null;

  const patch = (id: string, change: Partial<PlanTable>) => {
    setTables((cur) => cur.map((t) => (t.id === id ? { ...t, ...change } : t)));
    setDirty(true);
    setMessage(null);
  };

  const place = (t: PlanTable) => {
    const size = defaultSize(t.maxCovers);
    // First free spot, scanning left to right, top to bottom, with a gap round each table.
    const boxes = inArea
      .filter((x) => x.x != null && x.y != null)
      .map((x) => ({ x: x.x!, y: x.y!, w: x.w ?? defaultSize(x.maxCovers).w, h: x.h ?? defaultSize(x.maxCovers).h }));
    let spot = { x: 40, y: 40 };
    search: for (let y = 40; y + size.h <= PLAN_H; y += 20) {
      for (let x = 40; x + size.w <= PLAN_W; x += 20) {
        const clear = boxes.every((b) => x + size.w + 30 <= b.x || b.x + b.w + 30 <= x || y + size.h + 30 <= b.y || b.y + b.h + 30 <= y);
        if (clear) {
          spot = { x, y };
          break search;
        }
      }
    }
    patch(t.id, { ...spot, w: size.w, h: size.h, shape: t.maxCovers <= 2 ? "round" : "rect" });
    setSelected(t.id);
  };

  const save = () =>
    start(async () => {
      const res = await saveFloorPlan(
        venueId,
        tables.map((t) => ({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h, shape: t.shape, rotate: t.rotate })),
      );
      setMessage(res.error ?? "Saved.");
      if (!res.error) setDirty(false);
    });

  const sizeStep = (dw: number, dh: number) => {
    if (!sel) return;
    const base = defaultSize(sel.maxCovers);
    patch(sel.id, { w: Math.max(40, Math.min(300, (sel.w ?? base.w) + dw)), h: Math.max(40, Math.min(300, (sel.h ?? base.h) + dh)) });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AreaTabs tabs={tabs} active={active} onChange={(id) => { setActive(id); setSelected(null); }} />
        <div className="flex items-center gap-3">
          {message && <span className="text-sm text-zinc-600">{message}</span>}
          {dirty && !message && <span className="text-sm text-amber-700">Unsaved changes</span>}
          <button type="button" onClick={save} disabled={pending || !dirty} className={buttonStyles("primary", "sm")}>
            {pending ? "Saving..." : "Save floor plan"}
          </button>
        </div>
      </div>

      <FloorCanvas tables={inArea} editable selectedId={selected} onSelect={setSelected} onMove={(id, x, y) => patch(id, { x, y })} />

      <div className="flex min-h-[3.25rem] flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
        {sel && sel.x != null ? (
          <>
            <span className="mr-2 font-semibold text-zinc-900">
              {sel.label} <span className="font-normal text-zinc-500">({sel.maxCovers} seats)</span>
            </span>
            <button type="button" onClick={() => patch(sel.id, { shape: sel.shape === "round" ? "rect" : "round" })} className={buttonStyles("secondary", "sm")}>
              {sel.shape === "round" ? "Make square" : "Make round"}
            </button>
            <button type="button" onClick={() => sizeStep(20, 0)} className={buttonStyles("secondary", "sm")}>
              Wider
            </button>
            <button type="button" onClick={() => sizeStep(-20, 0)} className={buttonStyles("secondary", "sm")}>
              Narrower
            </button>
            <button type="button" onClick={() => sizeStep(0, 20)} className={buttonStyles("secondary", "sm")}>
              Deeper
            </button>
            <button type="button" onClick={() => sizeStep(0, -20)} className={buttonStyles("secondary", "sm")}>
              Shallower
            </button>
            <button type="button" onClick={() => patch(sel.id, { rotate: (sel.rotate + 45) % 180 })} className={buttonStyles("secondary", "sm")}>
              Turn
            </button>
            <button type="button" onClick={() => { patch(sel.id, { x: null, y: null }); setSelected(null); }} className="ml-auto text-sm font-medium text-red-700 hover:underline">
              Take off plan
            </button>
          </>
        ) : (
          <span className="text-zinc-500">Select a table on the plan to change its shape or size.</span>
        )}
      </div>

      {unplaced.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-800">Not on the plan yet</span>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((t) => (
              <button key={t.id} type="button" onClick={() => place(t)} className="rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:border-[var(--accent)]">
                {t.label} <span className="text-zinc-500">· {t.maxCovers}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
