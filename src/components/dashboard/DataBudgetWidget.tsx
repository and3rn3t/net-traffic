/**
 * Data budget tracker widget: month-to-date usage against a user-configured
 * monthly cap (persisted in AppContext preferences), with a linear
 * end-of-month projection.
 */
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatBytes } from '@/lib/formatters';
import { useDataBudget } from '@/hooks/useDataBudget';
import { useApp } from '@/contexts/AppContext';

export function DataBudgetWidget() {
  const {
    currentBytes,
    projectedMonthBytes,
    daysElapsed,
    daysInMonth,
    capGb,
    percentOfCap,
    projectedPercentOfCap,
    isLoading,
  } = useDataBudget();
  const { updatePreferences } = useApp();
  const [capInput, setCapInput] = useState(capGb !== undefined ? String(capGb) : '');

  const handleCapChange = (value: string) => {
    setCapInput(value);
    const parsed = Number(value);
    updatePreferences({
      monthlyDataCapGb: value === '' || Number.isNaN(parsed) ? undefined : parsed,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{formatBytes(currentBytes)}</div>
          <div className="text-xs text-muted-foreground">
            used, day {daysElapsed} of {daysInMonth}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="monthly-cap" className="text-xs text-muted-foreground">
            Cap (GB)
          </Label>
          <Input
            id="monthly-cap"
            type="number"
            min={0}
            className="h-8 w-20"
            value={capInput}
            onChange={e => handleCapChange(e.target.value)}
          />
        </div>
      </div>

      {percentOfCap !== undefined ? (
        <>
          <Progress value={Math.min(percentOfCap, 100)} />
          <div className="text-xs text-muted-foreground">
            {percentOfCap.toFixed(0)}% of {capGb} GB used - projected{' '}
            {formatBytes(projectedMonthBytes)} ({projectedPercentOfCap?.toFixed(0)}%) by month end
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">
          Set a monthly cap to track usage against a budget. Projected total by month end:{' '}
          {formatBytes(projectedMonthBytes)}.
        </div>
      )}
    </div>
  );
}
