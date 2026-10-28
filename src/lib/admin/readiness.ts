import { prisma } from "@/lib/db/client";

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  /** Blocks taking bookings properly when not done; the rest are recommended. */
  required: boolean;
  detail: string;
  href: string;
}

/**
 * What a venue still needs before its booking page is ready for guests,
 * worked out from its settings. Shared by the Go live page and the venue
 * picker's progress line.
 */
export async function venueReadiness(venueId: string): Promise<{ items: ReadinessItem[]; live: boolean; slug: string }> {
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      slug: true,
      phone: true,
      email: true,
      address: true,
      logoImageType: true,
      logoUrl: true,
      brandColorHex: true,
      headerImageType: true,
      legalEntityName: true,
      paymentAccountId: true,
      googleReviewUrl: true,
      onlineBookingLive: true,
      openingHours: { select: { dayOfWeek: true } },
      tables: { where: { active: true }, select: { id: true } },
      bookingTypes: {
        where: { active: true },
        select: { name: true, depositType: true, requiresPreOrder: true, preOrderPaymentRequired: true, preOrderMenuId: true, noShowFeePence: true, capacityMode: true },
      },
    },
  });
  const base = `/admin/${venue.slug}`;
  const types = venue.bookingTypes;
  const takesMoney = types.some((t) => t.depositType !== "NONE" || (t.requiresPreOrder && t.preOrderPaymentRequired) || t.noShowFeePence);
  const missingMenus = types.filter((t) => t.requiresPreOrder && !t.preOrderMenuId).map((t) => t.name);
  const needsTables = types.some((t) => t.capacityMode !== "TICKETED");

  const items: ReadinessItem[] = [
    {
      key: "contact",
      label: "Contact details",
      done: !!(venue.phone && venue.email && venue.address),
      required: true,
      detail: "Phone, email and address. Guests see these on the booking page and every email, and the email address is what guest emails come from.",
      href: `${base}/details`,
    },
    {
      key: "hours",
      label: "Opening hours",
      done: venue.openingHours.length > 0,
      required: true,
      detail: "At least one day open. Booking times come from these.",
      href: `${base}/hours`,
    },
    {
      key: "tables",
      label: "Tables",
      done: !needsTables || venue.tables.length > 0,
      required: true,
      detail: "Each table with its seats, so the system knows what's free.",
      href: `${base}/tables`,
    },
    {
      key: "types",
      label: "Booking types",
      done: types.length > 0,
      required: true,
      detail: "What guests can book, like a food table or bottomless brunch.",
      href: `${base}/booking-types`,
    },
    {
      key: "menus",
      label: "Pre-order menus linked",
      done: missingMenus.length === 0,
      required: true,
      detail: missingMenus.length ? `${missingMenus.join(", ")} ${missingMenus.length === 1 ? "needs" : "need"} a menu.` : "Every booking type with a pre-order has its menu.",
      href: `${base}/booking-types`,
    },
    {
      key: "payments",
      label: "Card payments",
      done: !takesMoney || (!!venue.paymentAccountId && !!venue.legalEntityName),
      required: true,
      detail: takesMoney
        ? "Some booking types take payment, so the venue needs its Dojo account and company name set. Owners do this in Venue details, Card payments."
        : "Not needed yet: nothing you offer takes payment.",
      href: `${base}/details`,
    },
    {
      key: "brand",
      label: "Logo and colour",
      done: !!((venue.logoImageType || venue.logoUrl) && venue.brandColorHex),
      required: false,
      detail: "So the booking page and emails look like yours.",
      href: `${base}/details`,
    },
    {
      key: "header",
      label: "Header photo",
      done: !!venue.headerImageType,
      required: false,
      detail: "A wide photo across the top of the booking page.",
      href: `${base}/details`,
    },
    {
      key: "review",
      label: "Google review link",
      done: !!venue.googleReviewUrl,
      required: false,
      detail: "The thank-you email asks guests for a review.",
      href: `${base}/details`,
    },
  ];
  return { items, live: venue.onlineBookingLive, slug: venue.slug };
}
