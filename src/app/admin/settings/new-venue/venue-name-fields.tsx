"use client";

import { useState } from "react";
import { slugify } from "@/lib/venues/new-venue";

const input = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

/** Name and web address, with the address following the name until it's edited by hand. */
export function VenueNameFields({ bookingBase }: { bookingBase: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const shown = touched ? slug : slugify(name);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Venue name</span>
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="The Fox and Hound" className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Booking page address</span>
        <input
          name="slug"
          value={shown}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
          }}
          className={`${input} font-mono`}
        />
        <span className="truncate text-xs text-zinc-500">
          {bookingBase}/book/{shown || "..."}
        </span>
      </label>
    </div>
  );
}
