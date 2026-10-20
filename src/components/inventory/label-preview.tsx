import type { LabelScene } from "@/lib/inventory/label-layout";
export function LabelPreview({ scene }: { scene: LabelScene }) {
  return (
    <svg
      role="img"
      aria-label={`${scene.width} by ${scene.height} millimetre wraparound label preview`}
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      className="h-auto w-full min-w-[500px] border border-slate-300 bg-white shadow-sm"
    >
      <rect width={scene.width} height={scene.height} fill="white" />
      {scene.seamMm ? (
        <rect
          x={scene.width - scene.seamMm}
          width={scene.seamMm}
          height={scene.height}
          fill="#f1f5f9"
        />
      ) : null}
      {scene.elements.map((e, i) =>
        e.kind === "image" ? (
          <image
            key={i}
            href={e.data}
            x={e.x}
            y={e.y}
            width={e.width}
            height={e.height}
          />
        ) : e.kind === "rect" ? (
          <rect
            key={i}
            x={e.x}
            y={e.y}
            width={e.width}
            height={e.height}
            fill={e.colour}
          />
        ) : e.kind === "text" ? (
          <text
            key={i}
            x={e.x}
            y={e.y}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={e.size}
            fontWeight={e.bold ? "bold" : "normal"}
            fill={e.colour}
          >
            {e.text}
          </text>
        ) : (
          <g
            key={i}
            transform={
              e.rotated
                ? `translate(${e.x + e.height},${e.y}) rotate(90)`
                : `translate(${e.x},${e.y})`
            }
            fill="black"
            shapeRendering="geometricPrecision"
          >
            {e.bars.map((b, j) => (
              <rect key={j} x={b.x} y="0" width={b.width} height={b.height} />
            ))}
            <text
              x={e.width / 2}
              y={e.barHeight + 4.5}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="3"
              textAnchor="middle"
            >
              {e.text}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}
