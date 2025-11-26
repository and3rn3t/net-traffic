/**
 * Lazy-loaded component wrappers for heavy components
 * Reduces initial bundle size and improves load time
 */
import { lazy } from 'react';

// Heavy visualization components - lazy load these
export const NetworkGraphLazy = lazy(() =>
  import('./NetworkGraph').then(module => ({ default: module.NetworkGraph }))
);

export const GeographicMapLazy = lazy(() =>
  import('./GeographicMap').then(module => ({ default: module.GeographicMap }))
);

export const FlowPipeVisualizationLazy = lazy(() =>
  import('./FlowPipeVisualization').then(module => ({
    default: module.FlowPipeVisualization,
  }))
);

export const HeatmapTimelineLazy = lazy(() =>
  import('./HeatmapTimeline').then(module => ({ default: module.HeatmapTimeline }))
);

export const ProtocolSankeyLazy = lazy(() =>
  import('./ProtocolSankey').then(module => ({ default: module.ProtocolSankey }))
);

export const RadarChartLazy = lazy(() =>
  import('./RadarChart').then(module => ({ default: module.RadarChart }))
);

// Analytics components
export const HistoricalTrendsLazy = lazy(() =>
  import('./HistoricalTrends').then(module => ({ default: module.HistoricalTrends }))
);

export const PeakUsageAnalysisLazy = lazy(() =>
  import('./PeakUsageAnalysis').then(module => ({ default: module.PeakUsageAnalysis }))
);

export const BandwidthPatternsLazy = lazy(() =>
  import('./BandwidthPatterns').then(module => ({ default: module.BandwidthPatterns }))
);

export const ProtocolTimelineLazy = lazy(() =>
  import('./ProtocolTimeline').then(module => ({ default: module.ProtocolTimeline }))
);

export const UserActivityTimelineLazy = lazy(() =>
  import('./UserActivityTimeline').then(module => ({ default: module.UserActivityTimeline }))
);

// Heavy analysis components
export const AnomalyDetectionLazy = lazy(() =>
  import('./AnomalyDetection').then(module => ({ default: module.AnomalyDetection }))
);

export const SecurityPostureLazy = lazy(() =>
  import('./SecurityPosture').then(module => ({ default: module.SecurityPosture }))
);

export const BandwidthCostEstimatorLazy = lazy(() =>
  import('./BandwidthCostEstimator').then(module => ({ default: module.BandwidthCostEstimator }))
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
