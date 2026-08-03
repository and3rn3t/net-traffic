/**
 * Hook for managing configurable alert rules and the live triggered-alert feed
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useWebSocketSubscription } from '@/contexts/WebSocketContext';
import { AlertRule, AlertRuleInput, TriggeredAlert } from '@/lib/types';
import { toast } from 'sonner';
import { API_CONFIG } from '@/hooks/useApiConfig';

const USE_REAL_API = API_CONFIG.USE_REAL_API;

export function useAlerts() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!USE_REAL_API) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [rulesData, triggeredData] = await Promise.all([
        apiClient.getAlertRules(),
        apiClient.getTriggeredAlerts(100),
      ]);

      setRules(rulesData || []);
      setTriggeredAlerts(triggeredData || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alerts';
      setError(errorMessage);
      console.error('Alerts fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live triggered-alert feed via the shared WebSocket pub/sub - a no-op
  // subscription when USE_REAL_API is false, since nothing ever publishes.
  useWebSocketSubscription('alert_triggered', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const message = data as Record<string, unknown>;
    if (!message.alert || typeof message.alert !== 'object') return;

    const alert = message.alert as TriggeredAlert;
    setTriggeredAlerts(current => [alert, ...current].slice(0, 100));

    if (alert.severity === 'critical' || alert.severity === 'high') {
      toast.error(`Alert: ${alert.description}`, {
        description: `Severity: ${alert.severity}`,
      });
    } else {
      toast.warning(`Alert: ${alert.description}`, {
        description: `Severity: ${alert.severity}`,
      });
    }
  });

  const createRule = useCallback(async (rule: AlertRuleInput) => {
    const created = await apiClient.createAlertRule(rule);
    setRules(current => [created, ...current]);
    return created;
  }, []);

  const updateRule = useCallback(async (ruleId: string, rule: Partial<AlertRuleInput>) => {
    const updated = await apiClient.updateAlertRule(ruleId, rule);
    setRules(current => current.map(r => (r.id === ruleId ? updated : r)));
    return updated;
  }, []);

  const deleteRule = useCallback(async (ruleId: string) => {
    await apiClient.deleteAlertRule(ruleId);
    setRules(current => current.filter(r => r.id !== ruleId));
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    await apiClient.acknowledgeAlert(alertId);
    setTriggeredAlerts(current =>
      current.map(a => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  }, []);

  return {
    rules,
    triggeredAlerts,
    isLoading,
    error,
    refresh,
    createRule,
    updateRule,
    deleteRule,
    acknowledgeAlert,
  };
}
