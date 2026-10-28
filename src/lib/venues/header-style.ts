/**
 * How a venue's header photo is framed in its banner, shared by the staff
 * app's editor and the customer booking page so the preview matches what
 * guests see. Kept identical in both repos.
 */
export interface HeaderFraming {
  headerPosX: number;
  headerPosY: number;
  headerZoom: number;
  headerDim: number;
}

export const DEFAULT_FRAMING: HeaderFraming = { headerPosX: 50, headerPosY: 50, headerZoom: 100, headerDim: 30 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

/** Style for the <img>: which part stays in view, and how far it's zoomed in. */
export function headerImageStyle(f: HeaderFraming): Record<string, string> {
  const x = clamp(f.headerPosX, 0, 100);
  const y = clamp(f.headerPosY, 0, 100);
  const zoom = clamp(f.headerZoom, 100, 300) / 100;
  return {
    objectPosition: `${x}% ${y}%`,
    transform: zoom > 1 ? `scale(${zoom})` : "none",
    transformOrigin: `${x}% ${y}%`,
  };
}

/** Darkening over the photo so the white name card and text stay readable. 30 matches the original look. */
export function headerOverlayStyle(f: HeaderFraming): Record<string, string> {
  const d = clamp(f.headerDim, 0, 80) / 100;
  return {
    background: `linear-gradient(to bottom, rgba(0,0,0,${(d / 3).toFixed(3)}), rgba(0,0,0,${((2 * d) / 3).toFixed(3)}) 50%, rgba(0,0,0,${Math.min(1, 2 * d).toFixed(3)}))`,
  };
}
