import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Serves a venue's uploaded logo for the admin preview (the customer app has
 * the same route for the public booking page and emails). Reads the shared
 * database directly. Returns 404 when no image has been uploaded.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await prisma.venue.findUnique({
    where: { slug },
    select: { logoImage: true, logoImageType: true },
  });
  if (!venue?.logoImage || !venue.logoImageType) {
    return NextResponse.json({ error: "No logo for this venue." }, { status: 404 });
  }
  const bytes = venue.logoImage as unknown as Uint8Array;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: { "Content-Type": venue.logoImageType, "Cache-Control": "private, max-age=60" },
  });
}
