import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { WIDGET_DEFINITIONS } from '@/components/dashboard/widgetRegistry';

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeWidgetIds: string[];
  onAddWidget: (id: string) => void;
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  activeWidgetIds,
  onAddWidget,
}: AddWidgetDialogProps) {
  const available = WIDGET_DEFINITIONS.filter(w => !activeWidgetIds.includes(w.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add widget</DialogTitle>
          <DialogDescription>Choose a widget to add to your dashboard.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All available widgets are already on your dashboard.
            </p>
          )}
          {available.map(widget => (
            <div
              key={widget.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{widget.title}</p>
                <p className="text-xs text-muted-foreground">{widget.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onAddWidget(widget.id);
                  onOpenChange(false);
                }}
              >
                <Plus size={14} />
                Add
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
