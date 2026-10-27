/** Tags offered as one-tap choices on a guest; staff can add their own too. */
export const PRESET_TAGS = ["VIP", "Regular", "Friends & family", "Press", "Staff", "Celebrating", "Difficult"];

/** Reads the tag checkboxes and the "other tags" box from a guest form. */
export function tagsFromForm(formData: FormData): string[] {
  const picked = formData.getAll("tags").map(String);
  const other = String(formData.get("tagsOther") ?? "")
    .split(",")
    .map((t) => t.trim().slice(0, 24))
    .filter(Boolean);
  return [...picked, ...other];
}
