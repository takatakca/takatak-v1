/**
 * Clean edge between the light marketplace header and the dark hero (or the
 * reverse). A restrained angled mask — no oversized wave shapes.
 */
export function SectionTransition({
  direction = "to-dark",
  className = "",
}: {
  direction?: "to-dark" | "to-light";
  className?: string;
}) {
  return (
    <div aria-hidden className={`tk-section-edge ${className}`} data-direction={direction} />
  );
}
