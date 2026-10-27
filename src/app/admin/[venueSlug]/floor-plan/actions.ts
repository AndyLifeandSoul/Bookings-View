"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";

export interface PlanUpdate {
  id: string;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  shape: string | null;
  rotate: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** Saves every table's position, size, shape and rotation on the floor plan in one go. */
export async function saveFloorPlan(venueId: string, updates: PlanUpdate[]): Promise<{ error?: string }> {
  await requireAdminSession();
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  const owned = new Set((await prisma.table.findMany({ where: { venueId }, select: { id: true } })).map((t) => t.id));
  const valid = updates.filter((u) => owned.has(u.id));
  await prisma.$transaction(
    valid.map((u) =>
      prisma.table.update({
        where: { id: u.id },
        data:
          u.x == null || u.y == null
            ? { planX: null, planY: null, planW: null, planH: null, planShape: null, planRotate: 0 }
            : {
                planX: clamp(u.x, 0, 1000),
                planY: clamp(u.y, 0, 640),
                planW: u.w == null ? null : clamp(u.w, 30, 400),
                planH: u.h == null ? null : clamp(u.h, 30, 400),
                planShape: u.shape === "round" ? "round" : "rect",
                planRotate: [0, 45, 90, 135].includes(u.rotate) ? u.rotate : 0,
              },
      }),
    ),
  );
  revalidatePath(`/admin/${venue.slug}/floor-plan`);
  return {};
}
