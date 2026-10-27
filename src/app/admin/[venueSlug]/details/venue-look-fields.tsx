"use client";

import { useState } from "react";

const HEX = /^#[0-9a-fA-F]{6}$/;
const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const PHOTO_TYPES = "image/png,image/jpeg,image/webp";

/** Black or white, whichever reads better on the brand colour (same rule the booking page uses). */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#18181b" : "#ffffff";
}

/** Previews a chosen file; the old preview URL is released when it's replaced. */
function usePreview(): [string | null, (file: File | null) => void] {
  const [url, setUrl] = useState<string | null>(null);
  const set = (file: File | null) =>
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  return [url, set];
}

/**
 * Logo, header photo, brand colour and tagline, with a live preview of the
 * top of the guest booking page so the venue can see what guests will see
 * before saving. Field names match updateVenueDetails.
 */
export function VenueLookFields({
  venueName,
  tagline,
  brandColorHex,
  logoSrc,
  headerSrc,
}: {
  venueName: string;
  tagline: string;
  brandColorHex: string | null;
  logoSrc: string | null;
  headerSrc: string | null;
}) {
  const [colour, setColour] = useState(brandColorHex && HEX.test(brandColorHex) ? brandColorHex.toLowerCase() : "#0f8c7b");
  const [colourText, setColourText] = useState(colour);
  const [line, setLine] = useState(tagline);
  const [logoPreview, setLogoPreview] = usePreview();
  const [headerPreview, setHeaderPreview] = usePreview();
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeHeader, setRemoveHeader] = useState(false);

  const shownLogo = logoPreview ?? (removeLogo ? null : logoSrc);
  const shownHeader = headerPreview ?? (removeHeader ? null : headerSrc);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Tagline</span>
          <input
            type="text"
            name="tagline"
            maxLength={90}
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="Brunch, cocktails and late nights in Nantwich"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
          <span className="text-xs text-zinc-500">One short line under your name on the booking page and in search results.</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Logo</span>
          <input
            type="file"
            name="logo"
            accept={IMAGE_TYPES}
            onChange={(e) => setLogoPreview(e.target.files?.[0] ?? null)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm"
          />
          <span className="text-xs text-zinc-500">PNG, JPG, WEBP, GIF or SVG, up to 2MB. A transparent PNG or SVG looks best. Used on the booking page and every guest email.</span>
          {logoSrc && !logoPreview && (
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
              Remove the current logo
            </label>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Header photo</span>
          <input
            type="file"
            name="headerImage"
            accept={PHOTO_TYPES}
            onChange={(e) => setHeaderPreview(e.target.files?.[0] ?? null)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm"
          />
          <span className="text-xs text-zinc-500">A wide photo of the venue, at least 1600 pixels across. JPG, PNG or WEBP, up to 5MB. Without one, the top of the page uses your brand colour.</span>
          {headerSrc && !headerPreview && (
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" name="removeHeaderImage" checked={removeHeader} onChange={(e) => setRemoveHeader(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
              Remove the current photo
            </label>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Brand colour</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick a colour"
              value={colour}
              onChange={(e) => {
                setColour(e.target.value);
                setColourText(e.target.value);
              }}
              className="h-9 w-12 cursor-pointer rounded-md border border-zinc-300 bg-white p-0.5"
            />
            <input
              type="text"
              name="brandColorHex"
              value={colourText}
              onChange={(e) => {
                setColourText(e.target.value);
                if (HEX.test(e.target.value.trim())) setColour(e.target.value.trim().toLowerCase());
              }}
              className="w-28 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
            />
          </div>
          <span className="text-xs text-zinc-500">Buttons, the selected date and time, and email headings. Text on it switches between black and white to stay readable.</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</span>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-[#f6f5f3]">
          {shownHeader ? (
            <div className="relative h-24 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownHeader} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/60" />
            </div>
          ) : (
            <div className="h-16 w-full" style={{ background: colour }} />
          )}
          <div className="relative -mt-7 px-3 pb-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              {shownLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownLogo} alt="" className="h-8 w-auto max-w-[5rem] object-contain" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">Book at {venueName}</p>
                {line && <p className="truncate text-xs text-zinc-600">{line}</p>}
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              {["Fri 12", "Sat 13", "Sun 14"].map((d, i) => (
                <span
                  key={d}
                  className="rounded-lg border px-2 py-1 text-[11px] font-medium"
                  style={i === 1 ? { background: colour, color: inkOn(colour), borderColor: colour } : { background: "#fff", color: "#3f3f46", borderColor: "#e4e4e7" }}
                >
                  {d}
                </span>
              ))}
            </div>
            <span className="mt-3 block rounded-lg py-1.5 text-center text-xs font-semibold" style={{ background: colour, color: inkOn(colour) }}>
              Continue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
