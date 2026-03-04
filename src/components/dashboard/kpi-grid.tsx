import { PerformanceSnapshot } from "@/types/database";
import { MetricCard } from "./metric-card";

interface KpiGridProps {
  snapshots: PerformanceSnapshot[];
  openWorkOrders?: number;
}

export function KpiGrid({ snapshots, openWorkOrders }: KpiGridProps) {
  const current = snapshots[0];
  const previous = snapshots[1];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Net Operating Income"
        value={current?.noi}
        previousValue={previous?.noi}
        format="currency"
      />
      <MetricCard
        label="Vacancy Rate"
        value={current?.vacancy_rate}
        previousValue={previous?.vacancy_rate}
        format="percent"
        invertTrend
      />
      <MetricCard
        label="Rent Collection"
        value={current?.rent_collection_rate}
        previousValue={previous?.rent_collection_rate}
        format="percent"
      />
      <MetricCard
        label="Open Work Orders"
        value={openWorkOrders ?? current?.work_orders_opened}
        format="number"
      />
      <MetricCard
        label="Total Units"
        value={current?.total_units}
        format="number"
      />
      <MetricCard
        label="Monthly Revenue"
        value={current?.effective_gross_income}
        previousValue={previous?.effective_gross_income}
        format="currency"
      />
      <MetricCard
        label="Avg Completion Time"
        value={current?.avg_completion_hours}
        previousValue={previous?.avg_completion_hours}
        format="hours"
        invertTrend
      />
      <MetricCard
        label="Tenant Retention"
        value={current?.tenant_retention_rate}
        previousValue={previous?.tenant_retention_rate}
        format="percent"
      />
    </div>
  );
}
