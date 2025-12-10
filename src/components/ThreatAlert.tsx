import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ShieldCheck } from 'lucide-react';
import { Threat } from '@/lib/types';
import { formatTimestamp } from '@/lib/formatters';
import { motion } from 'framer-motion';

interface ThreatAlertProps {
  threat: Threat;
  onDismiss: (id: string) => void;
}

export function ThreatAlert({ threat, onDismiss }: ThreatAlertProps) {
  const severityColors = {
    low: 'bg-warning/10 text-warning border-warning/20',
    medium: 'bg-warning/20 text-warning border-warning/30',
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  const typeLabels = {
    malware: '🦠 Malware',
    exfiltration: '📤 Data Exfiltration',
    scan: '🔍 Port Scan',
    botnet: '🤖 Botnet',
    phishing: '🎣 Phishing',
    anomaly: '⚠️ Anomaly',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card className="p-4 border border-border/50">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={severityColors[threat.severity]}>
                {threat.severity.toUpperCase()}
              </Badge>
              <span className="text-sm font-medium">{typeLabels[threat.type]}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatTimestamp(threat.timestamp)}
              </span>
            </div>

            <p className="text-sm text-foreground">{threat.description}</p>

            <div className="flex items-start gap-2 p-2 bg-accent/5 rounded border border-accent/10">
              <ShieldCheck className="text-accent mt-0.5 flex-shrink-0" size={16} />
              <p className="text-xs text-muted-foreground">{threat.recommendation}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDismiss(threat.id)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
