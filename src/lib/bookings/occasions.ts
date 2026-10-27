/** Occasions a guest or staff member can pick for a booking. Stored as the key. */
export const OCCASIONS = [
  { key: "BIRTHDAY", label: "Birthday" },
  { key: "ANNIVERSARY", label: "Anniversary" },
  { key: "DATE", label: "Date night" },
  { key: "CELEBRATION", label: "Celebration" },
  { key: "WORK", label: "Work do" },
  { key: "CHRISTMAS", label: "Christmas party" },
  { key: "OTHER", label: "Something else" },
] as const;

export function occasionLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return OCCASIONS.find((o) => o.key === key)?.label ?? key;
}

export function isOccasion(key: string): boolean {
  return OCCASIONS.some((o) => o.key === key);
}
