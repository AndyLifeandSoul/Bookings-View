/** "Black Bear Lodge" -> "black-bear-lodge", the address of its booking page. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** "black-bear-lodge" -> "BLACK_BEAR_LODGE", its Dojo account code (DOJO_API_KEY_<code>). */
export function accountCodeFor(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "_");
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
