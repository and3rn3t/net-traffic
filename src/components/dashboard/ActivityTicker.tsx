/**
 * Live activity ticker widget: recent device/threat/alert events, newest first.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Cpu, Radio, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useActivityFeed,
  type ActivityEvent,
  type ActivityEventType,
} from '@/hooks/useActivityFeed';
import { formatTimestamp } from '@/lib/formatters';

const TYPE_ICONS: Record<ActivityEventType, typeof Cpu> = {
  device: Cpu,
  threat: ShieldAlert,
  alert: Bell,
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-warning/20 text-warning border-warning/30',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  critical: 'bg-destructive/20 text-destructive border-destructive/30',
};

function ActivityRow({ event }: { readonly event: ActivityEvent }) {
  const Icon = TYPE_ICONS[event.type];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-start gap-2 text-sm"
    >
      <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 leading-snug">{event.message}</span>
      {event.severity && (
        <Badge className={SEVERITY_COLORS[event.severity]} variant="outline">
          {event.severity}
        </Badge>
      )}
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatTimestamp(event.timestamp)}
      </span>
    </motion.li>
  );
}

export function ActivityTicker() {
  const { events } = useActivityFeed();

  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Radio size={16} />
        Waiting for activity...
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto">
      <AnimatePresence initial={false}>
        {events.map(event => (
          <ActivityRow key={event.id} event={event} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
