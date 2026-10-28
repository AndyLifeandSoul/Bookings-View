"use client";

import { useRef } from "react";
import { DEFAULT_FRAMING, headerImageStyle, headerOverlayStyle, type HeaderFraming } from "@/lib/venues/header-style";

/**
 * Frame the header photo: drag either preview to choose which part stays in
 * view, zoom in, and set how dark it sits behind the venue name. Shown at
 * the banner's real shape on a computer and on a phone, because the same
 * photo is cropped very differently on each. Submits headerPosX, headerPosY,
 * headerZoom and headerDim with the Venue details form.
 */
export function HeaderFramingFields({
  src,
  value,
  onChange,
}: {
  src: string;
  value: HeaderFraming;
  onChange: (next: HeaderFraming) => void;
}) {
  const set = (patch: Partial<HeaderFraming>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-800">Position the photo</span>
        <button type="button" onClick={() => onChange(DEFAULT_FRAMING)} className="text-xs font-medium text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-800">
          Reset
        </button>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">Drag a preview to move the photo. Both show exactly what guests see.</p>

      <Frame label="On a computer" aspect="1280 / 224" src={src} value={value} onMove={set} />
      <div className="w-1/2 min-w-[11rem]">
        <Frame label="On a phone" aspect="390 / 176" src={src} value={value} onMove={set} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Zoom" name="headerZoom" min={100} max={250} step={5} value={value.headerZoom} suffix="%" onChange={(n) => set({ headerZoom: n })} />
        <Slider label="Darken" name="headerDim" min={0} max={80} step={5} value={value.headerDim} suffix="%" onChange={(n) => set({ headerDim: n })} />
        <Slider label="Across" name="headerPosX" min={0} max={100} step={1} value={value.headerPosX} suffix="%" onChange={(n) => set({ headerPosX: n })} />
        <Slider label="Up and down" name="headerPosY" min={0} max={100} step={1} value={value.headerPosY} suffix="%" onChange={(n) => set({ headerPosY: n })} />
      </div>
    </div>
  );
}

function Frame({
  label,
  aspect,
  src,
  value,
  onMove,
}: {
  label: string;
  aspect: string;
  src: string;
  value: HeaderFraming;
  onMove: (patch: Partial<HeaderFraming>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <div
        ref={ref}
        className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-zinc-200 active:cursor-grabbing"
        style={{ aspectRatio: aspect }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: value.headerPosX, py: value.headerPosY };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const box = ref.current?.getBoundingClientRect();
          if (!d || !box) return;
          // Dragging the photo right shows more of its left side, so the focus moves left.
          const nx = d.px - ((e.clientX - d.x) / box.width) * 100;
          const ny = d.py - ((e.clientY - d.y) / box.height) * 100;
          onMove({ headerPosX: Math.round(Math.min(100, Math.max(0, nx))), headerPosY: Math.round(Math.min(100, Math.max(0, ny))) });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" style={headerImageStyle(value)} />
        <div className="pointer-events-none absolute inset-0" style={headerOverlayStyle(value)} />
      </div>
    </div>
  );
}

function Slider({
  label,
  name,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string;
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-zinc-600">
        {label}
        <span className="tabular-nums text-zinc-500">
          {value}
          {suffix}
        </span>
      </span>
      <input type="range" name={name} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--accent)]" />
    </label>
  );
}
