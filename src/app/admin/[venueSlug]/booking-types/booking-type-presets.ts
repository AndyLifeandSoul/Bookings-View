/**
 * Starting points for a new booking type. Picking one fills the form with
 * settings that suit that kind of booking; every value can be changed before
 * saving, and nothing here is stored until the form is submitted. Field
 * meanings match BookingType in schema.prisma.
 */
export type PresetId = "table" | "drinks" | "brunch" | "christmas" | "event" | "area" | "private" | "blank";

export interface PresetValues {
  name: string;
  isPrivateHireType: boolean;
  minPartySize: number;
  maxPartySize: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  durationStepMinutes: number;
  startTimeStepMinutes: number;
  bufferMinutes: number;
  runsUntilClose: boolean;
  availableDaysOfWeek: number[];
  dayWindows: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[];
  tableFillMode: "PER_BOOKING" | "WHOLE_AREA" | "WHOLE_VENUE";
  requiresPreOrder: boolean;
  preOrderPaymentRequired: boolean;
  preOrderMinItemsPerPerson: number | null;
  preOrderMaxItemsPerPerson: number | null;
  bookingCutoffDays: number | null;
  // Optional extras; anything left out uses the form's plain default.
  minLeadMinutes?: number | null;
  requiresAgeConfirmation?: boolean;
  capacityMode?: "TABLES" | "TICKETED";
  ticketCapacity?: number | null;
  preOrderDeadlineDays?: number | null;
  isGroupParty?: boolean;
  depositType?: "NONE" | "FIXED" | "PER_HEAD";
  depositPounds?: string;
  enquiryThresholdPartySize?: number | null;
  waitlistEnabled?: boolean;
  openOnSpecialDates?: boolean;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const BASE: PresetValues = {
  name: "",
  isPrivateHireType: false,
  minPartySize: 1,
  maxPartySize: 10,
  minDurationMinutes: 120,
  maxDurationMinutes: 120,
  durationStepMinutes: 30,
  startTimeStepMinutes: 15,
  bufferMinutes: 0,
  runsUntilClose: false,
  availableDaysOfWeek: EVERY_DAY,
  dayWindows: [],
  tableFillMode: "PER_BOOKING",
  requiresPreOrder: false,
  preOrderPaymentRequired: false,
  preOrderMinItemsPerPerson: null,
  preOrderMaxItemsPerPerson: null,
  bookingCutoffDays: null,
};

export const PRESETS: { id: PresetId; label: string; blurb: string; values: PresetValues }[] = [
  {
    id: "table",
    label: "Food table",
    blurb: "A table for a meal, for a set length of time.",
    values: { ...BASE, name: "Food table", minPartySize: 1, maxPartySize: 8 },
  },
  {
    id: "drinks",
    label: "Drinks table",
    blurb: "A table for drinks. Guests choose how long they stay.",
    values: { ...BASE, name: "Drinks table", minPartySize: 2, maxPartySize: 12, maxDurationMinutes: 180 },
  },
  {
    id: "brunch",
    label: "Bottomless brunch",
    blurb: "A set sitting with a pre-order paid upfront. Closes two days ahead so you can order stock.",
    values: {
      openOnSpecialDates: false,
      ...BASE,
      name: "Bottomless brunch",
      minPartySize: 2,
      maxPartySize: 12,
      minDurationMinutes: 90,
      maxDurationMinutes: 90,
      startTimeStepMinutes: 30,
      availableDaysOfWeek: [6],
      dayWindows: [{ dayOfWeek: 6, earliestBookingTime: "12:00", latestBookingTime: "14:30" }],
      requiresPreOrder: true,
      preOrderPaymentRequired: true,
      preOrderMinItemsPerPerson: 1,
      preOrderMaxItemsPerPerson: 1,
      bookingCutoffDays: 2,
      requiresAgeConfirmation: true,
    },
  },
  {
    id: "christmas",
    label: "Christmas party",
    blurb: "Groups book with a deposit per head, then each guest picks their own food from a shared link.",
    values: {
      openOnSpecialDates: false,
      ...BASE,
      name: "Christmas party",
      minPartySize: 8,
      maxPartySize: 40,
      minDurationMinutes: 180,
      maxDurationMinutes: 180,
      startTimeStepMinutes: 30,
      requiresPreOrder: true,
      preOrderPaymentRequired: false,
      preOrderMinItemsPerPerson: 1,
      isGroupParty: true,
      preOrderDeadlineDays: 7,
      depositType: "PER_HEAD",
      depositPounds: "10",
      enquiryThresholdPartySize: 30,
    },
  },
  {
    id: "event",
    label: "Class or event",
    blurb: "A masterclass, tasting or quiz night sold by the place, up to a set number per session.",
    values: {
      openOnSpecialDates: false,
      ...BASE,
      name: "Cocktail masterclass",
      minPartySize: 1,
      maxPartySize: 10,
      capacityMode: "TICKETED",
      ticketCapacity: 16,
      depositType: "PER_HEAD",
      depositPounds: "35",
      waitlistEnabled: true,
      minDurationMinutes: 90,
      maxDurationMinutes: 90,
      startTimeStepMinutes: 30,
      bookingCutoffDays: 1,
    },
  },
  {
    id: "area",
    label: "Area hire",
    blurb: "Reserves a whole area, every table in it, for one group.",
    values: {
      ...BASE,
      name: "Area hire",
      minPartySize: 10,
      maxPartySize: 60,
      minDurationMinutes: 180,
      maxDurationMinutes: 240,
      durationStepMinutes: 60,
      startTimeStepMinutes: 30,
      tableFillMode: "WHOLE_AREA",
    },
  },
  {
    id: "private",
    label: "Private hire",
    blurb: "The whole venue for one group. Can use your private-hire-only days and hours.",
    values: {
      ...BASE,
      name: "Private hire",
      isPrivateHireType: true,
      minPartySize: 20,
      maxPartySize: 150,
      minDurationMinutes: 240,
      maxDurationMinutes: 360,
      durationStepMinutes: 60,
      startTimeStepMinutes: 30,
      tableFillMode: "WHOLE_VENUE",
    },
  },
  {
    id: "blank",
    label: "Something else",
    blurb: "Start from plain settings and set everything yourself.",
    values: { ...BASE },
  },
];
