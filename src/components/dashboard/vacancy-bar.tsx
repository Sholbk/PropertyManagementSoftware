import { cn } from "@/lib/utils";

interface VacancyBarProps {
  occupied: number;
  vacant: number;
  total: number;
  className?: string;
}

export function VacancyBar({ occupied, vacant, total, className }: VacancyBarProps) {
  if (total === 0) return null;
  const occupiedPct = (occupied / total) * 100;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{occupied} occupied</span>
        <span>{vacant} vacant</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-red-200">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${occupiedPct}%` }}
        />
      </div>
    </div>
  );
}
