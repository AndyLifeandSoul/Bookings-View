import Link from "next/link";
import { MessageCirclePlus, CalendarClock, UserRound, Wallet } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { buttonStyles } from "@/components/ui/button";
import { occasionLabel } from "@/lib/bookings/occasions";
import { ENQUIRY_STAGES } from "@/lib/bookings/enquiry-stages";
import { StageSelect } from "./stage-select";

export const dynamic = "force-dynamic";

/**
 * Enquiries as a pipeline: New, Contacted, Proposal sent, each a column of
 * cards with the date, group, budget, owner and follow-up date (red once
 * it's due). Big groups, private hire and Christmas parties live here until
 * they're confirmed or closed as lost. Filters: mine, and follow-ups due.
 * Below the board, the last 30 days of wins and losses.
 */
export default async function EnquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { venueSlug } = await params;
  const { filter } = await searchParams;
  const { venue, session } = await requireStaffVenue(venueSlug);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

  const open = await prisma.booking.findMany({
    where: {
      venueId: venue.id,
      status: "ENQUIRY",
      ...(filter === "mine" ? { assignedToId: session.staffUserId } : {}),
      ...(filter === "due" ? { followUpDate: { lte: today } } : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      partySize: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      enquiryStage: true,
      followUpDate: true,
      budgetPence: true,
      occasion: true,
      createdAt: true,
      assignedTo: { select: { name: true } },
      bookingType: { select: { name: true } },
    },
  });

  const monthAgo = new Date(today.getTime() - 30 * 86_400_000);
  const recent = await prisma.booking.findMany({
    where: { venueId: venue.id, enquiryStage: { in: ["WON", "LOST"] }, updatedAt: { gte: monthAgo } },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, customerName: true, partySize: true, date: true, enquiryStage: true, lostReason: true, budgetPence: true },
  });

  const columns = ENQUIRY_STAGES.map((stage) => ({
    ...stage,
    cards: open.filter((b) => (b.enquiryStage ?? "NEW") === stage.key),
  }));
  const won = recent.filter((r) => r.enquiryStage === "WON");
  const lost = recent.filter((r) => r.enquiryStage === "LOST");
  const pipelineValue = open.reduce((s, b) => s + (b.budgetPence ?? 0), 0);

  const filters = [
    { key: undefined, label: "All" },
    { key: "mine", label: "Mine" },
    { key: "due", label: "Follow-ups due" },
  ];

  return (
    <div className="animate-in mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Enquiries</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {open.length} open{pipelineValue > 0 ? `, about £${Math.round(pipelineValue / 100).toLocaleString("en-GB")} in budgets` : ""}. Won {won.length}, lost {lost.length} in the last 30 days.
          </p>
        </div>
        <Link href={`/staff/${venue.slug}/enquiries/new`} className={buttonStyles("primary", "sm")}>
          <MessageCirclePlus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add enquiry
        </Link>
      </div>

      <div className="mt-4 flex gap-1.5">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={`/staff/${venue.slug}/enquiries${f.key ? `?filter=${f.key}` : ""}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${filter === f.key ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <section key={col.key} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-zinc-100/70 p-3">
            <h2 className="flex items-center justify-between px-1 text-sm font-semibold text-zinc-700">
              {col.label}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-500">{col.cards.length}</span>
            </h2>
            {col.cards.length === 0 && <p className="px-1 py-4 text-center text-xs text-zinc-400">Nothing here.</p>}
            {col.cards.map((b) => {
              const due = b.followUpDate && b.followUpDate <= today;
              return (
                <article key={b.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/staff/${venue.slug}/bookings/${b.id}`} className="min-w-0">
                      <p className="truncate font-semibold text-zinc-900 hover:text-[var(--accent)]">{b.customerName}</p>
                      <p className="text-xs text-zinc-500">
                        {b.bookingType.name}
                        {b.occasion ? `, ${occasionLabel(b.occasion)?.toLowerCase()}` : ""}
                      </p>
                    </Link>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{b.partySize}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-700">
                    {b.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} at {b.startTime}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {b.budgetPence != null && (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> £{Math.round(b.budgetPence / 100)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3 w-3" /> {b.assignedTo?.name ?? "No owner"}
                    </span>
                    {b.followUpDate && (
                      <span className={`inline-flex items-center gap-1 ${due ? "font-semibold text-red-700" : ""}`}>
                        <CalendarClock className="h-3 w-3" />
                        {due ? "Chase now" : `Chase ${b.followUpDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
                    <span className="truncate text-xs text-zinc-500">{b.customerPhone ?? b.customerEmail}</span>
                    <StageSelect id={b.id} venueId={venue.id} venueSlug={venue.slug} stage={b.enquiryStage ?? "NEW"} />
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-700">Last 30 days</h2>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link href={`/staff/${venue.slug}/bookings/${r.id}`} className="font-medium text-zinc-900 hover:text-[var(--accent)]">
                  {r.customerName}, {r.partySize} guests
                </Link>
                <span className={`text-xs font-semibold ${r.enquiryStage === "WON" ? "text-emerald-700" : "text-zinc-500"}`}>
                  {r.enquiryStage === "WON" ? "Won" : `Lost${r.lostReason ? `: ${r.lostReason}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
