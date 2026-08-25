export function MiniSpark({ points }: { points?: number[] }) {
  const d =
    points && points.length > 1
      ? points
          .map((y, i) => {
            const x = (i / (points.length - 1)) * 70 + 1;
            const yy = 24 - y * 20;
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${yy.toFixed(1)}`;
          })
          .join(" ")
      : "M1 14 L71 14";
  const up = !points || points[points.length - 1]! >= (points[0] ?? 0);
  return (
    <svg className="spark" viewBox="0 0 72 28" fill="none" aria-hidden>
      <path d={d} stroke={up ? "#10b981" : "#f43f5e"} strokeWidth="1.5" opacity={points ? 1 : 0.35} />
    </svg>
  );
}
