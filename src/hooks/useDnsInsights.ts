/**
 * useDnsInsights: polls the DNS insights endpoint for query volume, failure
 * rate, top queried domains, and unusual (uncommon) TLDs.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useApiConfig } from '@/hooks/useApiConfig';

const POLL_INTERVAL_MS = 60000;

export interface DnsResponseCodeCount {
  code: string;
  count: number;
}

export interface DnsTopDomain {
  domain: string;
  query_count: number;
  failure_count: number;
}

export interface DnsUnusualTld {
  tld: string;
  count: number;
}

export interface DnsInsights {
  totalQueries: number;
  failureCount: number;
  failureRate: number;
  responseCodes: DnsResponseCodeCount[];
  topDomains: DnsTopDomain[];
  unusualTlds: DnsUnusualTld[];
  isLoading: boolean;
}

export function useDnsInsights(limit: number = 10, hours: number = 24): DnsInsights {
  const { useRealApi } = useApiConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['dns-stats', limit, hours],
    queryFn: () => apiClient.getDnsStats(limit, hours),
    enabled: useRealApi,
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: POLL_INTERVAL_MS,
  });

  return {
    totalQueries: data?.total_queries ?? 0,
    failureCount: data?.failure_count ?? 0,
    failureRate: data?.failure_rate ?? 0,
    responseCodes: data?.response_codes ?? [],
    topDomains: data?.top_domains ?? [],
    unusualTlds: data?.unusual_tlds ?? [],
    isLoading,
  };
}
