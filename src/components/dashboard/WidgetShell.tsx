import type { ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WidgetShellProps {
  title: string;
  editMode: boolean;
  onRemove: () => void;
  children: ReactNode;
  className?: string;
}

/** Card chrome shared by every dashboard widget: title, drag handle, and remove control in edit mode. */
export function WidgetShell({ title, editMode, onRemove, children, className }: WidgetShellProps) {
  return (
    <Card className={cn('h-full overflow-hidden py-0', className)}>
      <CardHeader
        className={cn(
          'border-b py-3 flex-row items-center gap-2 [.border-b]:pb-3',
          editMode && 'widget-drag-handle cursor-grab active:cursor-grabbing'
        )}
      >
        {editMode && <GripVertical size={16} className="text-muted-foreground shrink-0" />}
        <CardTitle className="flex-1 text-sm">{title}</CardTitle>
        {editMode && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={`Remove ${title} widget`}
            onClick={onRemove}
          >
            <X size={14} />
          </Button>
        )}
      </CardHeader>
      <div className="flex-1 overflow-auto px-6 pb-6">{children}</div>
    </Card>
  );
}
