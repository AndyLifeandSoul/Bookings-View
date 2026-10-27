"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

/** Plan coordinates live in a fixed 1000 x 640 space and are scaled to fit the screen. */
export const PLAN_W = 1000;
export const PLAN_H = 640;

export interface PlanTable {
  id: string;
  label: string;
  maxCovers: number;
  areaId: string | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  shape: string | null;
  rotate: number;
}

export interface LiveState {
  tone: "free" | "soon" | "due" | "seated" | "late";
  title?: string;
  sub?: string;
  href?: string;
}

export function defaultSize(covers: number): { w: number; h: number } {
  if (covers <= 2) return { w: 60, h: 60 };
  if (covers <= 4) return { w: 80, h: 70 };
  if (covers <= 6) return { w: 110, h: 70 };
  if (covers <= 10) return { w: 150, h: 80 };
  return { w: 200, h: 90 };
}

const TONE: Record<LiveState["tone"], string> = {
  free: "bg-white border-zinc-300 text-zinc-700",
  soon: "bg-sky-50 border-sky-400 text-sky-900",
  due: "bg-amber-50 border-amber-400 text-amber-900",
  late: "bg-red-50 border-red-400 text-red-900",
  seated: "bg-emerald-100 border-emerald-500 text-emerald-950",
};

function TableShape({
  t,
  selected,
  live,
  style,
  onPointerDown,
  onClick,
}: {
  t: PlanTable & { x: number; y: number; w: number; h: number };
  selected?: boolean;
  live?: LiveState;
  style: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
}) {
  const round = t.shape === "round";
  const tone = live ? TONE[live.tone] : "bg-white border-zinc-400 text-zinc-800";
  const body = (
    <div
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={style}
      className={`absolute flex touch-none select-none flex-col items-center justify-center overflow-hidden border-2 text-center leading-tight shadow-sm ${round ? "rounded-full" : "rounded-lg"} ${tone} ${
        selected ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""
      } ${onPointerDown ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <span className="text-[11px] font-bold">{t.label}</span>
      {live?.title ? (
        <>
          <span className="max-w-full truncate px-1 text-[10px] font-semibold">{live.title}</span>
          {live.sub && <span className="text-[9px] opacity-80">{live.sub}</span>}
        </>
      ) : (
        <span className="text-[9px] opacity-70">{t.maxCovers} seats</span>
      )}
    </div>
  );
  if (live?.href) {
    return (
      <Link href={live.href} className="contents">
        {body}
      </Link>
    );
  }
  return body;
}

/**
 * Draws one area's tables on a scaled canvas. In edit mode tables can be
 * dragged, and the selected one reshaped; in live mode each table shows
 * who's on it and links to the booking.
 */
export function FloorCanvas({
  tables,
  live,
  editable = false,
  selectedId,
  onSelect,
  onMove,
}: {
  tables: PlanTable[];
  live?: Record<string, LiveState>;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; scale: number } | null>(null);
  const placed = tables.filter((t) => t.x != null && t.y != null);

  function toPlan(e: React.PointerEvent): { x: number; y: number; scale: number } {
    const rect = ref.current!.getBoundingClientRect();
    const scale = rect.width / PLAN_W;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale, scale };
  }

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-[radial-gradient(circle,#e4e4e7_1px,transparent_1px)] [background-size:20px_20px]"
      style={{ aspectRatio: `${PLAN_W} / ${PLAN_H}` }}
      onPointerMove={(e) => {
        if (!drag.current || !onMove) return;
        const p = toPlan(e);
        const t = tables.find((x) => x.id === drag.current!.id);
        if (!t) return;
        const w = t.w ?? defaultSize(t.maxCovers).w;
        const h = t.h ?? defaultSize(t.maxCovers).h;
        const nx = Math.round(Math.min(PLAN_W - w, Math.max(0, p.x - drag.current.dx)) / 10) * 10;
        const ny = Math.round(Math.min(PLAN_H - h, Math.max(0, p.y - drag.current.dy)) / 10) * 10;
        onMove(t.id, nx, ny);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      onClick={(e) => {
        if (e.target === ref.current) onSelect?.(null);
      }}
    >
      {placed.map((t) => {
        const size = { w: t.w ?? defaultSize(t.maxCovers).w, h: t.h ?? defaultSize(t.maxCovers).h };
        const pos = { ...t, x: t.x!, y: t.y!, ...size };
        return (
          <TableShape
            key={t.id}
            t={pos}
            selected={selectedId === t.id}
            live={live?.[t.id] ?? (live ? { tone: "free" } : undefined)}
            style={{
              left: `${(pos.x / PLAN_W) * 100}%`,
              top: `${(pos.y / PLAN_H) * 100}%`,
              width: `${(pos.w / PLAN_W) * 100}%`,
              height: `${(pos.h / PLAN_H) * 100}%`,
              transform: t.rotate ? `rotate(${t.rotate}deg)` : undefined,
            }}
            onPointerDown={
              editable
                ? (e) => {
                    e.preventDefault();
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                    const p = toPlan(e);
                    drag.current = { id: t.id, dx: p.x - pos.x, dy: p.y - pos.y, scale: p.scale };
                    onSelect?.(t.id);
                  }
                : undefined
            }
          />
        );
      })}
      {placed.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          {editable ? "Tap a table below to put it on the plan, then drag it into place." : "No floor plan drawn for this area yet."}
        </p>
      )}
    </div>
  );
}

/** Area tabs shared by the editor and the live view. */
export function useAreaTabs(tables: PlanTable[], areas: { id: string; name: string }[]) {
  const tabs = useMemo(() => {
    const list = areas.filter((a) => tables.some((t) => t.areaId === a.id)).map((a) => ({ id: a.id as string | null, name: a.name }));
    if (tables.some((t) => !t.areaId)) list.push({ id: null, name: "Other tables" });
    return list;
  }, [tables, areas]);
  const [active, setActive] = useState<string | null>(tabs[0]?.id ?? null);
  return { tabs, active, setActive };
}

export function AreaTabs({ tabs, active, onChange }: { tabs: { id: string | null; name: string }[]; active: string | null; onChange: (id: string | null) => void }) {
  if (tabs.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button
          key={t.id ?? "none"}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-full px-3 py-1 text-sm font-medium ${active === t.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
