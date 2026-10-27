import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** The venue's booking page header photo, for the admin preview. The customer app serves the same image publicly. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await prisma.venue.findUnique({ where: { slug }, select: { headerImage: true, headerImageType: true } });
  if (!venue?.headerImage || !venue.headerImageType) {
    return NextResponse.json({ error: "No header image for this venue." }, { status: 404 });
  }
  const bytes = venue.headerImage as unknown as Uint8Array;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: { "Content-Type": venue.headerImageType, "Cache-Control": "no-store" },
  });
}
