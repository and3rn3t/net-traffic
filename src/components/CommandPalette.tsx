import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Activity,
  AlertTriangle,
  Database,
  Laptop,
  Moon,
  Network,
  Smartphone,
  Sun,
  TrendingUp,
} from 'lucide-react';
import type { Device } from '@/lib/types';
import { toast } from 'sonner';

interface CommandPaletteProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  devices: Device[];
  isCapturing: boolean;
  onToggleCapture: () => void;
}

const TAB_ITEMS: { value: string; label: string; icon: typeof Activity }[] = [
  { value: 'dashboard', label: 'Dashboard', icon: Activity },
  { value: 'devices', label: 'Devices', icon: Smartphone },
  { value: 'threats', label: 'Threats', icon: AlertTriangle },
  { value: 'analytics', label: 'Analytics', icon: TrendingUp },
  { value: 'system', label: 'System', icon: Database },
];

export function CommandPalette({
  activeTab,
  onTabChange,
  devices,
  isCapturing,
  onToggleCapture,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(current => !current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a view, device, or action"
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {TAB_ITEMS.filter(item => item.value !== activeTab).map(item => (
            <CommandItem
              key={item.value}
              value={`go to ${item.label}`}
              onSelect={() => runCommand(() => onTabChange(item.value))}
            >
              <item.icon />
              Go to {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {devices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Devices">
              {devices.slice(0, 8).map(device => (
                <CommandItem
                  key={device.id}
                  value={`device ${device.name} ${device.ip}`}
                  onSelect={() =>
                    runCommand(() => {
                      onTabChange('devices');
                      toast.info(`Device selected: ${device.name}`);
                    })
                  }
                >
                  <Laptop />
                  {device.name}
                  <span className="text-muted-foreground ml-auto text-xs">{device.ip}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="toggle packet capture" onSelect={() => runCommand(onToggleCapture)}>
            <Network />
            {isCapturing ? 'Pause' : 'Resume'} packet capture
          </CommandItem>
          <CommandItem value="light theme" onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun />
            Switch to light theme
          </CommandItem>
          <CommandItem value="dark theme" onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon />
            Switch to dark theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
