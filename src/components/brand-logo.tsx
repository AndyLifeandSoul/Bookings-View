/**
 * Book Me In brand logo: the "reserved spot" pin (a location pin holding a
 * tick, meaning the spot is saved) next to the wordmark. This is the
 * product's own mark, not a venue's - individual venue logos stay on the
 * customer-facing booking pages. The wordmark inherits the surrounding text
 * colour (currentColor) so one component works on the dark top bar (white
 * text) and the light login card (ink text); the pin keeps its teal fill
 * on both. Pure SVG + text, no client code.
 */
export function BrandLogo({
  markSize = 26,
  className = "",
  textClassName = "text-[15px]",
  showWordmark = true,
}: {
  markSize?: number;
  className?: string;
  textClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Book Me In"
        className="shrink-0"
      >
        <path
          d="M32 3C19 3 9 13 9 26c0 14 16 28 23 35 7-7 23-21 23-35C55 13 45 3 32 3Z"
          fill="#0F8C7B"
        />
        <path
          d="M23 26l7 7 13-15"
          fill="none"
          stroke="#ffffff"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className={`font-semibold tracking-tight ${textClassName}`}>Book Me In</span>
      )}
    </span>
  );
}
