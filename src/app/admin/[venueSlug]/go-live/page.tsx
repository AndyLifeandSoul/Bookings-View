import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { venueReadiness } from "@/lib/admin/readiness";
import { getCustomerAppUrl } from "@/lib/pre-order/links";
import { CopyLinkButton } from "@/components/copy-link-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const SOURCES = [
  { key: "instagram", label: "Instagram bio" },
  { key: "facebook", label: "Facebook page" },
  { key: "google", label: "Google Business profile" },
  { key: "email", label: "Your email newsletter" },
  { key: "qr", label: "QR codes on tables and posters" },
];

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="w-48 shrink-0 text-sm text-zinc-700">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs text-zinc-500">{url}</code>
      <CopyLinkButton url={url} />
    </div>
  );
}

/**
 * Everything to get a venue taking bookings: what's left to set up, the
 * links to share (each tagged so reports show where bookings came from),
 * and the code for the venue's own website.
 */
export default async function GoLivePage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  const [{ items, live }, types] = await Promise.all([
    venueReadiness(venue.id),
    prisma.bookingType.findMany({ where: { venueId: venue.id, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true, slug: true } }),
  ]);
  const base = getCustomerAppUrl();
  const page = `${base}/book/${venue.slug}`;
  const required = items.filter((i) => i.required);
  const requiredDone = required.filter((i) => i.done).length;
  const ready = requiredDone === required.length;

  const inline = `<script src="${base}/widget.js" data-venue="${venue.slug}"></script>`;
  const button = `<script src="${base}/widget.js" data-venue="${venue.slug}" data-mode="button" data-label="Book a table"></script>`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Go live</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {ready ? "Everything needed is set up." : `${requiredDone} of ${required.length} essentials done.`}{" "}
            {live ? "The booking page is taking bookings." : "The booking page is paused."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={live ? "success" : "warning"}>{live ? "Live" : "Paused"}</Badge>
          <a href={page} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "sm")}>
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
            Open booking page
          </a>
        </div>
      </div>

      {!live && ready && (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <p className="text-sm text-emerald-900">
            Ready when you are. Switch on &quot;Taking bookings online&quot; in{" "}
            <Link href={`/admin/${venue.slug}/details`} className="font-semibold underline">
              Venue details
            </Link>
            .
          </p>
        </Card>
      )}

      <Card padded={false} className="divide-y divide-zinc-100">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50">
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2} />
            ) : (
              <Circle className={`mt-0.5 h-5 w-5 shrink-0 ${item.required ? "text-amber-500" : "text-zinc-300"}`} strokeWidth={2} />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                {item.label}
                {!item.required && <span className="text-xs font-normal text-zinc-400">Recommended</span>}
              </span>
              <span className="block text-xs text-zinc-500">{item.detail}</span>
            </span>
            {!item.done && <span className="text-sm font-medium text-[var(--accent)]">Set up</span>}
          </Link>
        ))}
      </Card>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">Links to share</h3>
        <p className="text-sm text-zinc-500">Each link is tagged, so the Reports page shows how many bookings came from each place.</p>
        <Card padded={false} className="divide-y divide-zinc-100">
          <LinkRow label="Booking page" url={page} />
          {SOURCES.map((s) => (
            <LinkRow key={s.key} label={s.label} url={`${page}?source=${s.key}`} />
          ))}
        </Card>
        {types.length > 1 && (
          <>
            <p className="mt-2 text-sm text-zinc-500">Straight to one booking type, for a brunch post or a Christmas campaign:</p>
            <Card padded={false} className="divide-y divide-zinc-100">
              {types.map((t) => (
                <LinkRow key={t.slug} label={t.name} url={`${page}?type=${t.slug}`} />
              ))}
            </Card>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">On your website</h3>
        <p className="text-sm text-zinc-500">Paste one of these where you want booking to appear. Your web designer will know what to do with it.</p>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-800">Booking form in the page</span>
              <CopyLinkButton url={inline} label="Copy code" />
            </div>
            <code className="block overflow-x-auto whitespace-pre rounded-md bg-zinc-900 px-3 py-2 text-xs text-zinc-100">{inline}</code>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-800">A &quot;Book a table&quot; button that opens it</span>
              <CopyLinkButton url={button} label="Copy code" />
            </div>
            <code className="block overflow-x-auto whitespace-pre rounded-md bg-zinc-900 px-3 py-2 text-xs text-zinc-100">{button}</code>
          </div>
          <p className="text-xs text-zinc-500">
            Add <code>data-type=&quot;bottomless-brunch&quot;</code> to open on one booking type, or change <code>data-label</code> for the button text. Payments always open on Dojo&apos;s secure page.
          </p>
        </Card>
      </section>
    </div>
  );
}
