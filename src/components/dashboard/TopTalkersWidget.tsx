/**
 * Top talkers leaderboard widget: devices ranked by bandwidth with
 * rank-change indicators since the previous poll.
 */
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useTopTalkers } from '@/hooks/useTopTalkers';
import { formatBytesShort, getDeviceIcon } from '@/lib/formatters';
import { cn } from '@/lib/utils';

function RankChangeIndicator({ rankChange }: { readonly rankChange: number }) {
  if (rankChange > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-success" aria-label="Moved up">
        <ArrowUp size={12} />
        {rankChange}
      </span>
    );
  }
  if (rankChange < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-destructive" aria-label="Moved down">
        <ArrowDown size={12} />
        {Math.abs(rankChange)}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground" aria-label="No change">
      <Minus size={12} />
    </span>
  );
}

export function TopTalkersWidget() {
  const { talkers, isLoading } = useTopTalkers(5);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading top talkers...
      </div>
    );
  }

  if (talkers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No device activity yet.
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto">
      {talkers.map(talker => (
        <li
          key={talker.device_id}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-2 text-sm',
            talker.rank === 0 && 'border-primary/30 bg-primary/5'
          )}
        >
          <span className="w-4 shrink-0 text-center text-xs font-semibold text-muted-foreground">
            {talker.rank + 1}
          </span>
          <span aria-hidden>{getDeviceIcon(talker.device_type)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{talker.device_name}</p>
            <p className="truncate text-xs text-muted-foreground">{talker.device_ip}</p>
          </div>
          <span className="shrink-0 text-xs font-medium">{formatBytesShort(talker.bytes)}</span>
          <RankChangeIndicator rankChange={talker.rankChange} />
        </li>
      ))}
    </ul>
  );
}
