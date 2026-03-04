interface TrendSparkProps {
  data: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}

export function TrendSpark({ data, width = 80, height = 24, color = "#3b82f6" }: TrendSparkProps) {
  const values = data.filter((v): v is number => v != null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}
