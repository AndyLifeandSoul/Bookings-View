"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

/** venueId comes from a hidden form field (set from the page's route param) — admin sessions are venue-independent, see requireAdminVenue(). */
async function resolveVenue(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  return venue;
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

function parseAreaFields(formData: FormData): { name: string; priority: number } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Area name is required." };
  const priorityRaw = Number(formData.get("priority") ?? 0);
  if (!Number.isFinite(priorityRaw)) return { error: "Priority must be a number." };
  return { name, priority: Math.trunc(priorityRaw) };
}

export async function createArea(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const parsed = parseAreaFields(formData);
  if ("error" in parsed) return parsed;

  const existing = await prisma.area.findUnique({ where: { venueId_name: { venueId: venue.id, name: parsed.name } } });
  if (existing) return { error: `An area called "${parsed.name}" already exists for this venue.` };

  await prisma.area.create({ data: { venueId: venue.id, ...parsed } });
  revalidatePath(`/admin/${venue.slug}/tables`);
}

export async function updateArea(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const parsed = parseAreaFields(formData);
  if ("error" in parsed) return parsed;

  const existing = await prisma.area.findUnique({ where: { venueId_name: { venueId: venue.id, name: parsed.name } } });
  if (existing && existing.id !== id) {
    return { error: `An area called "${parsed.name}" already exists for this venue.` };
  }

  const result = await prisma.area.updateMany({ where: { id, venueId: venue.id }, data: parsed });
  if (result.count === 0) return { error: "Area not found for this venue." };
  revalidatePath(`/admin/${venue.slug}/tables`);
}

export async function deleteArea(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  // Table.areaId is ON DELETE SET NULL (schema.prisma) — any tables in this
  // area just become unassigned, never blocked or cascade-deleted, so this
  // is always safe.
  await prisma.area.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/tables`);
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

interface ParsedTableFields {
  label: string;
  minCovers: number;
  maxCovers: number;
  areaId: string | null;
  sortOrder: number;
  active: boolean;
}

async function parseTableFields(
  formData: FormData,
  venueId: string,
): Promise<ParsedTableFields | { error: string }> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Table label is required." };

  const minCovers = Number(formData.get("minCovers"));
  const maxCovers = Number(formData.get("maxCovers"));
  if (!Number.isFinite(minCovers) || !Number.isFinite(maxCovers) || minCovers < 1 || maxCovers < minCovers) {
    return { error: "Covers range is invalid: max must be at least min, and min at least 1." };
  }

  const areaIdRaw = String(formData.get("areaId") ?? "").trim();
  let areaId: string | null = null;
  if (areaIdRaw) {
    const area = await prisma.area.findFirst({ where: { id: areaIdRaw, venueId }, select: { id: true } });
    if (!area) return { error: "That area doesn't belong to this venue." };
    areaId = area.id;
  }

  const sortOrderRaw = Number(formData.get("sortOrder") ?? 0);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;
  const active = formData.get("active") === "on";

  return { label, minCovers: Math.trunc(minCovers), maxCovers: Math.trunc(maxCovers), areaId, sortOrder, active };
}

export async function createTable(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const parsed = await parseTableFields(formData, venue.id);
  if ("error" in parsed) return parsed;

  const existing = await prisma.table.findUnique({ where: { venueId_label: { venueId: venue.id, label: parsed.label } } });
  if (existing) return { error: `A table labelled "${parsed.label}" already exists for this venue.` };

  await prisma.table.create({ data: { venueId: venue.id, ...parsed } });
  revalidatePath(`/admin/${venue.slug}/tables`);
  redirect(`/admin/${venue.slug}/tables`);
}

export async function updateTable(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const parsed = await parseTableFields(formData, venue.id);
  if ("error" in parsed) return parsed;

  const existing = await prisma.table.findUnique({ where: { venueId_label: { venueId: venue.id, label: parsed.label } } });
  if (existing && existing.id !== id) {
    return { error: `A table labelled "${parsed.label}" already exists for this venue.` };
  }

  const result = await prisma.table.updateMany({ where: { id, venueId: venue.id }, data: parsed });
  if (result.count === 0) return { error: "Table not found for this venue." };
  revalidatePath(`/admin/${venue.slug}/tables`);
  redirect(`/admin/${venue.slug}/tables`);
}

export async function deleteTable(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  const table = await prisma.table.findFirst({ where: { id, venueId: venue.id }, select: { label: true } });
  if (!table) return { error: "Table not found for this venue." };

  // BookingTable.tableId is ON DELETE RESTRICT (schema.prisma) — a table
  // that's ever been assigned to a real booking can't be hard-deleted, so
  // deactivate instead, matching the same pattern used for booking types
  // and menus once real records reference them.
  const bookingCount = await prisma.bookingTable.count({ where: { tableId: id } });
  if (bookingCount > 0) {
    await prisma.table.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/tables`);
    return {
      error: `"${table.label}" has ${bookingCount} booking(s) against it, so it can't be deleted, deactivated instead.`,
    };
  }

  await prisma.table.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/tables`);
}

// ---------------------------------------------------------------------------
// Table links (physical adjacency, for combining tables / spacing)
// ---------------------------------------------------------------------------

export async function createTableLink(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const tableAId = String(formData.get("tableAId") ?? "").trim();
  const tableBId = String(formData.get("tableBId") ?? "").trim();
  if (!tableAId || !tableBId) return { error: "Pick two tables to link." };
  if (tableAId === tableBId) return { error: "A table can't be linked to itself." };

  const [tableA, tableB] = await Promise.all([
    prisma.table.findFirst({ where: { id: tableAId, venueId: venue.id }, select: { id: true } }),
    prisma.table.findFirst({ where: { id: tableBId, venueId: venue.id }, select: { id: true } }),
  ]);
  if (!tableA || !tableB) return { error: "Both tables must belong to this venue." };

  // TableLink is modelled as a directed pair (see schema.prisma's doc
  // comment on the model) but meant to be read as unordered, so check both
  // orderings before inserting — otherwise A-B and B-A could both exist as
  // "different" links representing the same physical adjacency.
  const existing = await prisma.tableLink.findFirst({
    where: {
      OR: [
        { tableAId, tableBId },
        { tableAId: tableBId, tableBId: tableAId },
      ],
    },
  });
  if (existing) return { error: "These two tables are already linked." };

  await prisma.tableLink.create({ data: { tableAId, tableBId } });
  revalidatePath(`/admin/${venue.slug}/tables`);
}

export async function deleteTableLink(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  // Scope the delete through a venue-owned table rather than trusting the
  // link id alone, so a link can't be removed by guessing an id belonging
  // to another venue.
  const link = await prisma.tableLink.findFirst({
    where: { id, tableA: { venueId: venue.id } },
    select: { id: true },
  });
  if (!link) return { error: "Link not found for this venue." };

  await prisma.tableLink.delete({ where: { id } });
  revalidatePath(`/admin/${venue.slug}/tables`);
}
