export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  /** Default grid size in layout units (w columns x h rows). */
  defaultLayout: { w: number; h: number; minW?: number; minH?: number };
  /** Whether this widget is included in a brand-new dashboard by default. */
  defaultEnabled: boolean;
}

/**
 * Static metadata for every widget the "Add widget" catalog can offer.
 * Rendering is resolved separately in DashboardTab.tsx, which has access
 * to the live data each widget needs.
 */
export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: 'metrics',
    title: 'Key metrics',
    description: 'Active connections, throughput, devices, and threat score at a glance.',
    defaultLayout: { w: 12, h: 2, minW: 6, minH: 2 },
    defaultEnabled: true,
  },
  {
    id: 'traffic-chart',
    title: 'Traffic chart',
    description: 'Bandwidth over time, in and out.',
    defaultLayout: { w: 8, h: 4, minW: 4, minH: 3 },
    defaultEnabled: true,
  },
  {
    id: 'connections-table',
    title: 'Network connections',
    description: 'Live table of active and recent flows.',
    defaultLayout: { w: 12, h: 6, minW: 6, minH: 3 },
    defaultEnabled: true,
  },
  {
    id: 'activity-ticker',
    title: 'Live activity',
    description: 'Recent device, threat, and alert events as they happen.',
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    defaultEnabled: false,
  },
  {
    id: 'top-talkers',
    title: 'Top talkers',
    description: 'Devices ranked by bandwidth, with live rank-change indicators.',
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    defaultEnabled: false,
  },
  {
    id: 'throughput-gauge',
    title: 'Live throughput',
    description: 'Current bandwidth on a gauge, with a decaying peak-hold marker.',
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    defaultEnabled: false,
  },
  {
    id: 'health-score',
    title: 'Network health score',
    description: 'Blended 0-100 score from connection quality, threats, and anomalies.',
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    defaultEnabled: false,
  },
  {
    id: 'week-comparison',
    title: 'This week vs last week',
    description: 'Overlay of the last two 7-day bandwidth periods with a % delta callout.',
    defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
    defaultEnabled: false,
  },
  {
    id: 'dns-insights',
    title: 'DNS insights',
    description: 'Query volume, failure rate, top queried domains, and unusual TLDs.',
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    defaultEnabled: false,
  },
];

export function getWidgetDefinition(id: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find(widget => widget.id === id);
}
