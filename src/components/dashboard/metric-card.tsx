import { Card } from "@/components/ui/card";
import { cn, formatCurrency, formatPercent, formatNumber, formatHours } from "@/lib/utils";

type MetricFormat = "currency" | "percent" | "number" | "hours";

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  previousValue?: number | null;
  format?: MetricFormat;
  invertTrend?: boolean; // true = lower is better (e.g., vacancy rate)
}

const formatters: Record<MetricFormat, (v: number | null | undefined) => string> = {
  currency: formatCurrency,
  percent: formatPercent,
  number: formatNumber,
  hours: formatHours,
};

export function MetricCard({ label, value, previousValue, format = "number", invertTrend }: MetricCardProps) {
  const formatted = formatters[format](value);

  let trend: "up" | "down" | "flat" | null = null;
  let trendPct: string | null = null;

  if (value != null && previousValue != null && previousValue !== 0) {
    const change = ((value - previousValue) / Math.abs(previousValue)) * 100;
    if (Math.abs(change) < 0.5) {
      trend = "flat";
    } else {
      trend = change > 0 ? "up" : "down";
    }
    trendPct = `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
  }

  const trendIsGood = trend === "flat" || (invertTrend ? trend === "down" : trend === "up");

  return (
    <Card>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{formatted}</p>
      {trend && trendPct && (
        <p className={cn("mt-1 text-xs font-medium", trendIsGood ? "text-green-600" : "text-red-600")}>
          {trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2192"} {trendPct} vs prev
        </p>
      )}
    </Card>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card>
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-8 w-32 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-200" />
    </Card>
  );
}
