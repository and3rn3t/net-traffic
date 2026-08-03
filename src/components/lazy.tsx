/**
 * Lazy-loaded component wrappers for heavy components
 * Reduces initial bundle size and improves load time
 */
import { lazy } from 'react';

// Analytics components
export const HistoricalTrendsLazy = lazy(() =>
  import('./HistoricalTrends').then(module => ({ default: module.HistoricalTrends }))
);

// Heavy analysis components
export const AnomalyDetectionLazy = lazy(() =>
  import('./AnomalyDetection').then(module => ({ default: module.AnomalyDetection }))
);

/**
 * Suspense wrapper component for lazy-loaded components
 */
import { Suspense, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyWrapper({ children, fallback }: LazyWrapperProps) {
  const defaultFallback = (
    <Card className="p-4">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </Card>
  );

  return <Suspense fallback={fallback || defaultFallback}>{children}</Suspense>;
}
