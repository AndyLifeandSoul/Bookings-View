import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { saveEmailCopy } from "./actions";
import { EMAIL_KINDS } from "./kinds";
import { EmailCopyFields } from "./email-copy-form";

export const dynamic = "force-dynamic";

/** The venue's own words for the emails guests get, each with a live preview. */
export default async function GuestEmailsPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue: ref } = await requireAdminVenue(venueSlug);
  const [venue, rows] = await Promise.all([
    prisma.venue.findUniqueOrThrow({ where: { id: ref.id }, select: { id: true, name: true, brandColorHex: true } }),
    prisma.emailCopy.findMany({ where: { venueId: ref.id } }),
  ]);
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  const accent = venue.brandColorHex && /^#[0-9a-fA-F]{6}$/.test(venue.brandColorHex) ? venue.brandColorHex : "#0f8c7b";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Guest emails</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Put these in your own words. Booking details, payment, the manage booking button and calendar link are always included, so you only write the bits around them.
        </p>
      </div>
      {EMAIL_KINDS.map((k) => {
        const row = byKind.get(k.kind);
        return (
          <Card key={k.kind}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{k.title}</h3>
                <p className="text-xs text-zinc-500">{k.when}</p>
              </div>
              <Badge variant={row ? "success" : "neutral"}>{row ? "Your wording" : "Standard wording"}</Badge>
            </div>
            <ActionForm action={saveEmailCopy} resetOnSuccess={false} className="flex flex-col gap-4">
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="kind" value={k.kind} />
              <EmailCopyFields
                venueName={venue.name}
                accent={accent}
                heading={k.heading}
                defaults={{ subject: k.subject, intro: k.intro }}
                saved={{ subject: row?.subject ?? "", intro: row?.intro ?? "", footer: row?.footer ?? "" }}
              />
              <div>
                <SubmitButton label={`Save ${k.title.toLowerCase()} email`} className={buttonStyles("primary", "sm")} />
              </div>
            </ActionForm>
          </Card>
        );
      })}
    </div>
  );
}
