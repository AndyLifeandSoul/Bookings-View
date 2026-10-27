"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";
import { EMAIL_KINDS } from "./kinds";

/** Saves the venue's wording for one guest email. Blank fields fall back to the standard wording. */
export async function saveEmailCopy(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venueId = String(formData.get("venueId") ?? "").trim();
  const venue = venueId ? await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } }) : null;
  if (!venue) return { error: "Unknown venue." };
  const kind = String(formData.get("kind") ?? "");
  if (!EMAIL_KINDS.some((k) => k.kind === kind)) return { error: "Unknown email." };
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 140) || null;
  const intro = String(formData.get("intro") ?? "").trim().slice(0, 2000) || null;
  const footer = String(formData.get("footer") ?? "").trim().slice(0, 2000) || null;
  const unknown = [subject, intro, footer].join(" ").match(/\{(?!name\}|venue\}|date\}|time\}|guests\}|ref\})[a-z_]*\}/i);
  if (unknown) return { error: `${unknown[0]} isn't something we can fill in. Use {name}, {venue}, {date}, {time}, {guests} or {ref}.` };
  if (!subject && !intro && !footer) {
    await prisma.emailCopy.deleteMany({ where: { venueId: venue.id, kind } });
  } else {
    await prisma.emailCopy.upsert({
      where: { venueId_kind: { venueId: venue.id, kind } },
      create: { venueId: venue.id, kind, subject, intro, footer },
      update: { subject, intro, footer },
    });
  }
  revalidatePath(`/admin/${venue.slug}/emails`);
}
