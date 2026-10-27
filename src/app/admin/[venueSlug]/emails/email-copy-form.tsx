"use client";

import { useState } from "react";

const SAMPLE = { name: "Sam", venue: "", date: "Saturday 13 December 2026", time: "12:30", guests: "6", ref: "BBL-1042" };

function fill(text: string, venue: string): string {
  return text
    .replace(/\{name\}/g, SAMPLE.name)
    .replace(/\{venue\}/g, venue)
    .replace(/\{date\}/g, SAMPLE.date)
    .replace(/\{time\}/g, SAMPLE.time)
    .replace(/\{guests\}/g, SAMPLE.guests)
    .replace(/\{ref\}/g, SAMPLE.ref);
}

function paras(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const field = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

/** Subject, opening and closing words for one guest email, with a preview filled in with a sample booking. */
export function EmailCopyFields({
  venueName,
  accent,
  heading,
  defaults,
  saved,
}: {
  venueName: string;
  accent: string;
  heading: string;
  defaults: { subject: string; intro: string };
  saved: { subject: string; intro: string; footer: string };
}) {
  const [subject, setSubject] = useState(saved.subject);
  const [intro, setIntro] = useState(saved.intro);
  const [footer, setFooter] = useState(saved.footer);
  const shownSubject = fill(subject || defaults.subject, venueName);
  const shownIntro = paras(fill(intro || defaults.intro, venueName));
  const shownFooter = paras(fill(footer, venueName));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Subject</span>
          <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={defaults.subject} maxLength={140} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Opening</span>
          <textarea name="intro" rows={4} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={defaults.intro} className={field} />
          <span className="text-xs text-zinc-500">Leave a blank line between paragraphs.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Closing note</span>
          <textarea
            name="footer"
            rows={3}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Parking is free after 6pm on the High Street. Dogs are welcome on the terrace."
            className={field}
          />
          <span className="text-xs text-zinc-500">Added after the booking details. Good for parking, dress code, what to bring.</span>
        </label>
        <p className="text-xs text-zinc-500">
          Fill-ins: <code>{"{name}"}</code> <code>{"{venue}"}</code> <code>{"{date}"}</code> <code>{"{time}"}</code> <code>{"{guests}"}</code> <code>{"{ref}"}</code>. Leave a box blank to use the standard wording shown in grey.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</span>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 text-sm">
          <div className="border-b border-zinc-200 bg-white px-3 py-2">
            <p className="truncate text-xs text-zinc-500">Subject</p>
            <p className="truncate font-medium text-zinc-900">{shownSubject}</p>
          </div>
          <div className="m-3 rounded-lg bg-white p-4">
            <p className="text-base font-semibold" style={{ color: accent }}>
              {heading}
            </p>
            <div className="mt-2 flex flex-col gap-2 text-zinc-700">
              {shownIntro.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
            <div className="my-3 rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-500">Booking details: date, time, guests, reference</div>
            <div className="flex flex-col gap-2 text-zinc-700">
              {shownFooter.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
