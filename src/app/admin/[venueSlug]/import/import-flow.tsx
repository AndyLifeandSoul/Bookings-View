"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { previewBookingsImport, runBookingsImport, type ImportResult, type PreviewResult } from "./actions";

type Preview = Extract<PreviewResult, { rows: unknown }>;
type Done = Extract<ImportResult, { imported: number }>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function day(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function ImportFlow({ venueSlug }: { venueSlug: string }) {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [typeMap, setTypeMap] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setText(null);
    setFileName("");
    setPreview(null);
    setTypeMap({});
    setDone(null);
    setError(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    startTransition(async () => {
      const r = await previewBookingsImport(venueSlug, content);
      if ("error" in r) return setError(r.error);
      setPreview(r);
      setTypeMap(Object.fromEntries(r.types.map((t) => [t.name, t.matchedId ?? ""])));
    });
  }

  if (done) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <div className="text-base font-semibold text-zinc-900">
          {done.imported} booking{done.imported === 1 ? "" : "s"} imported
        </div>
        <p className="text-sm text-zinc-600">
          {done.withTables} given a table automatically.{done.skipped > 0 ? ` ${done.skipped} left out.` : ""}
        </p>
        {done.needTables.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">These need a table choosing in the diary (no free table fitted):</div>
            <ul className="mt-1 list-disc pl-5">
              {done.needTables.map((n) => (
                <li key={n.line}>
                  {n.name}, {n.partySize} guests, {day(n.dateStr)} at {n.startTime}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          <Link href={`/staff/${venueSlug}/diary`} className={buttonStyles("primary", "sm")}>
            Open the diary
          </Link>
          <button type="button" onClick={reset} className={buttonStyles("secondary", "sm")}>
            Import another file
          </button>
        </div>
      </Card>
    );
  }

  const unmapped = preview ? preview.types.filter((t) => !typeMap[t.name]) : [];
  const willImport = preview
    ? preview.rows.filter((r) => !r.skip && typeMap[r.typeName] && typeMap[r.typeName] !== "skip").length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-8 text-center hover:border-[var(--accent)]">
          <Upload className="h-6 w-6 text-zinc-400" strokeWidth={2} />
          <span className="text-sm font-medium text-zinc-800">{fileName || "Choose a CSV file"}</span>
          <span className="text-xs text-zinc-500">Needs at least name, date, time, guests and booking type columns.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {pending && !preview && <p className="mt-3 text-sm text-zinc-500">Reading the file…</p>}
        {error && <p className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">{error}</p>}
      </Card>

      {preview && (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <div className="text-sm font-semibold text-zinc-900">Booking types</div>
            <p className="-mt-2 text-xs text-zinc-500">Match each type in the file to one of yours, or leave it out.</p>
            {preview.types.length === 0 && <p className="text-sm text-zinc-500">Nothing in this file can be imported.</p>}
            {preview.types.map((t) => (
              <label key={t.name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium text-zinc-900">{t.name || "(no type)"}</span> <span className="text-zinc-500">· {t.count} booking{t.count === 1 ? "" : "s"}</span>
                </span>
                <select
                  value={typeMap[t.name] ?? ""}
                  onChange={(e) => setTypeMap((m) => ({ ...m, [t.name]: e.target.value }))}
                  className={`rounded-md border px-2 py-1.5 text-sm ${typeMap[t.name] ? "border-zinc-300" : "border-amber-400 bg-amber-50"}`}
                >
                  <option value="">Choose a booking type…</option>
                  {preview.bookingTypes.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.name}
                    </option>
                  ))}
                  <option value="skip">Don&apos;t import these</option>
                </select>
              </label>
            ))}
          </Card>

          <Card className="overflow-hidden">
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Guests</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const leftOut = r.skip ?? (typeMap[r.typeName] === "skip" ? "Type left out" : !typeMap[r.typeName] ? "Choose its type" : null);
                    return (
                      <tr key={r.line} className={`border-b border-zinc-50 last:border-0 ${leftOut ? "text-zinc-400" : "text-zinc-800"}`}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{day(r.dateStr)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.startTime ?? "-"}</td>
                        <td className="px-3 py-2">
                          {r.name}
                          {r.notes && <div className="max-w-xs truncate text-xs text-zinc-500">{r.notes}</div>}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{r.partySize ?? "-"}</td>
                        <td className="px-3 py-2">{r.typeName}</td>
                        <td className="px-3 py-2 text-right">
                          {leftOut ? <Badge variant="neutral">{leftOut}</Badge> : <Badge variant={r.status === "ENQUIRY" ? "info" : "success"}>{r.status === "ENQUIRY" ? "As enquiry" : "Import"}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || willImport === 0 || unmapped.length > 0 || !text}
              className={buttonStyles("primary", "md")}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await runBookingsImport(venueSlug, text!, typeMap);
                  if ("error" in r) setError(r.error);
                  else setDone(r);
                });
              }}
            >
              {pending ? "Importing…" : `Import ${willImport} booking${willImport === 1 ? "" : "s"}`}
            </button>
            {unmapped.length > 0 && <span className="text-sm text-amber-700">Choose a booking type for each type above first.</span>}
            <button type="button" onClick={reset} className={buttonStyles("ghost", "md")}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
