import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? to show keyboard shortcuts
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['⌘', 'K'], description: 'Open search' },
        { keys: ['Esc'], description: 'Close dialogs / Clear search' },
        { keys: ['?'], description: 'Show keyboard shortcuts' },
      ],
    },
    {
      category: 'Accessibility',
      items: [
        { keys: ['Tab'], description: 'Navigate forward' },
        { keys: ['Shift', 'Tab'], description: 'Navigate backward' },
        { keys: ['Enter'], description: 'Activate focused element' },
        { keys: ['Space'], description: 'Select / Toggle' },
      ],
    },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (Press ?)"
      >
        <Keyboard size={16} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Navigate NetInsight faster with keyboard shortcuts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {shortcuts.map(section => (
              <div key={section.category}>
                <h3 className="font-semibold mb-3">{section.category}</h3>
                <div className="space-y-2">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{item.description}</span>
                      <div className="flex gap-1">
                        {item.keys.map((key, keyIdx) => (
                          <div key={keyIdx} className="flex items-center gap-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              {key}
                            </Badge>
                            {keyIdx < item.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">+</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
