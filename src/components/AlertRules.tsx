/**
 * Alert Rules panel: configure threshold/value-based alert rules and review
 * the live triggered-alert feed (delivered via WebSocket/in-app only).
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash, BellRing, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAlerts } from '@/hooks/useAlerts';
import type { AlertMetric, AlertOperator, AlertRuleInput } from '@/lib/types';

interface AlertRulesProps {
  readonly className?: string;
}

const NUMERIC_METRICS: AlertMetric[] = ['rtt', 'retransmissions', 'jitter'];
const STRING_METRICS: AlertMetric[] = [
  'country',
  'application',
  'sni',
  'tcp_flags',
  'threat_level',
];

const NUMERIC_OPERATORS: AlertOperator[] = ['gt', 'gte', 'lt', 'lte', 'eq'];
const STRING_OPERATORS: AlertOperator[] = ['eq', 'in', 'contains'];

const METRIC_LABELS: Record<AlertMetric, string> = {
  rtt: 'Round-trip time (ms)',
  retransmissions: 'Retransmissions',
  jitter: 'Jitter (ms)',
  country: 'Country',
  application: 'Application',
  sni: 'TLS SNI hostname',
  tcp_flags: 'TCP flags',
  threat_level: 'Threat level',
};

const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'default',
  critical: 'destructive',
};

function defaultFormState(): AlertRuleInput {
  return {
    name: '',
    metric: 'rtt',
    operator: 'gt',
    threshold: 100,
    values: undefined,
    severity: 'medium',
    cooldownMinutes: 15,
    enabled: true,
  };
}

export function AlertRules({ className }: AlertRulesProps) {
  const {
    rules,
    triggeredAlerts,
    isLoading,
    createRule,
    updateRule,
    deleteRule,
    acknowledgeAlert,
  } = useAlerts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<AlertRuleInput>(defaultFormState());
  const [valuesText, setValuesText] = useState('');

  const isNumericMetric = NUMERIC_METRICS.includes(form.metric);
  const operatorOptions = isNumericMetric ? NUMERIC_OPERATORS : STRING_OPERATORS;

  const openCreateDialog = () => {
    setForm(defaultFormState());
    setValuesText('');
    setDialogOpen(true);
  };

  const handleMetricChange = (metric: AlertMetric) => {
    const numeric = NUMERIC_METRICS.includes(metric);
    setForm(current => ({
      ...current,
      metric,
      operator: numeric ? 'gt' : 'eq',
      threshold: numeric ? (current.threshold ?? 100) : undefined,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    const payload: AlertRuleInput = {
      ...form,
      values: isNumericMetric
        ? undefined
        : valuesText
            .split(',')
            .map(v => v.trim())
            .filter(Boolean),
      threshold: isNumericMetric ? form.threshold : undefined,
    };

    if (isNumericMetric && (payload.threshold === undefined || Number.isNaN(payload.threshold))) {
      toast.error('Threshold is required for this metric');
      return;
    }
    if (!isNumericMetric && (!payload.values || payload.values.length === 0)) {
      toast.error('At least one value is required for this metric');
      return;
    }

    setIsSaving(true);
    try {
      await createRule(payload);
      toast.success('Alert rule created');
      setDialogOpen(false);
    } catch (error) {
      toast.error('Failed to create alert rule', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (ruleId: string, enabled: boolean) => {
    try {
      await updateRule(ruleId, { enabled });
    } catch (error) {
      toast.error('Failed to update alert rule', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteRule(ruleId);
      toast.success('Alert rule deleted');
    } catch (error) {
      toast.error('Failed to delete alert rule', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
    } catch (error) {
      toast.error('Failed to acknowledge alert', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Alert Rules</CardTitle>
            <CardDescription>
              Configure threshold and value-based rules to trigger in-app alerts.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Alert Rule</DialogTitle>
                <DialogDescription>
                  Alerts trigger once per device per cooldown period when the condition matches.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Name</Label>
                  <Input
                    id="rule-name"
                    value={form.name}
                    onChange={e => setForm(current => ({ ...current, name: e.target.value }))}
                    placeholder="e.g. High latency to any device"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Select
                      value={form.metric}
                      onValueChange={v => handleMetricChange(v as AlertMetric)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...NUMERIC_METRICS, ...STRING_METRICS].map(metric => (
                          <SelectItem key={metric} value={metric}>
                            {METRIC_LABELS[metric]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <Select
                      value={form.operator}
                      onValueChange={v =>
                        setForm(current => ({ ...current, operator: v as AlertOperator }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorOptions.map(op => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isNumericMetric ? (
                  <div className="space-y-2">
                    <Label htmlFor="rule-threshold">Threshold</Label>
                    <Input
                      id="rule-threshold"
                      type="number"
                      value={form.threshold ?? ''}
                      onChange={e =>
                        setForm(current => ({ ...current, threshold: Number(e.target.value) }))
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="rule-values">Values (comma-separated)</Label>
                    <Input
                      id="rule-values"
                      value={valuesText}
                      onChange={e => setValuesText(e.target.value)}
                      placeholder="e.g. CN, RU"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                      value={form.severity}
                      onValueChange={v =>
                        setForm(current => ({
                          ...current,
                          severity: v as AlertRuleInput['severity'],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['low', 'medium', 'high', 'critical'].map(sev => (
                          <SelectItem key={sev} value={sev}>
                            {sev}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-cooldown">Cooldown (minutes)</Label>
                    <Input
                      id="rule-cooldown"
                      type="number"
                      value={form.cooldownMinutes}
                      onChange={e =>
                        setForm(current => ({
                          ...current,
                          cooldownMinutes: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Create Rule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alert rules configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      {METRIC_LABELS[rule.metric as AlertMetric] ?? rule.metric} {rule.operator}{' '}
                      {rule.threshold ?? rule.values?.join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[rule.severity]}>{rule.severity}</Badge>
                    </TableCell>
                    <TableCell>{rule.cooldownMinutes}m</TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={checked => handleToggleEnabled(rule.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Triggered Alerts
          </CardTitle>
          <CardDescription>Most recent alerts triggered by your rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {triggeredAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts triggered yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggeredAlerts.map(alert => (
                  <TableRow key={alert.id} className={alert.acknowledged ? 'opacity-60' : ''}>
                    <TableCell>{new Date(alert.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{alert.description}</TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[alert.severity]}>{alert.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!alert.acknowledged && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAcknowledge(alert.id)}
                          title="Acknowledge"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
