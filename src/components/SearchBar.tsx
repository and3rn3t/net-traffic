/**
 * Search component for devices, flows, and threats
 * Uses debouncing for better performance
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api';
import { Device, NetworkFlow, Threat } from '@/lib/types';
import { formatBytes, formatTimestamp } from '@/lib/formatters';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  onResultClick?: (type: 'device' | 'flow' | 'threat', id: string) => void;
}

export function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [searchType] = useState<'all' | 'devices' | 'flows' | 'threats'>('all');
  const [showResults, setShowResults] = useState(false);

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, 500);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  // Use React Query for search with automatic caching and deduplication
  const {
    data: results = { devices: [], flows: [], threats: [] },
    isLoading: isSearching,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['search', debouncedQuery, searchType],
    queryFn: async () => {
      if (!debouncedQuery.trim() || !USE_REAL_API) {
        return { devices: [], flows: [], threats: [] };
      }
      return await apiClient.search(
        debouncedQuery,
        searchType === 'all' ? 'all' : (searchType as 'devices' | 'flows' | 'threats'),
        20
      );
    },
    enabled: debouncedQuery.trim().length > 0 && USE_REAL_API,
    staleTime: 2 * 60 * 1000, // Cache search results for 2 minutes
  });

  // Auto-show results when search completes
  useEffect(() => {
    if (debouncedQuery.trim() && !isSearching && results) {
      const totalResults = results.devices.length + results.flows.length + results.threats.length;
      if (totalResults > 0) {
        setShowResults(true);
      }
    }
  }, [debouncedQuery, isSearching, results]);

  // Show error toast if search fails
  useEffect(() => {
    if (error) {
      toast.error('Search failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [error]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      // Trigger search by ensuring debounced query updates
      setShowResults(true);
    }
  };

  const totalResults = results.devices.length + results.flows.length + results.threats.length;

  return (
    <>
      <div className="relative w-full max-w-md">
        <Input
          type="text"
          placeholder="Search devices, flows, IP addresses..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            if (query && totalResults > 0) {
              setShowResults(true);
            }
          }}
          className="pl-10 pr-10"
        />
        <MagnifyingGlass
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => {
              setQuery('');
              setShowResults(false);
            }}
          >
            <X size={14} />
          </Button>
        )}
      </div>

      {/* Search Results Dialog */}
      {/* Open dialog when showResults is true AND (has results OR is searching/fetching OR there's a query) */}
      {/* When Enter is pressed, showResults is set to true, and if there's a query, the dialog should open immediately */}
      <Dialog
        open={
          showResults && (totalResults > 0 || isSearching || isFetching || query.trim().length > 0)
        }
        onOpenChange={setShowResults}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search Results</DialogTitle>
            <DialogDescription>
              {isSearching ? 'Searching...' : `Found ${totalResults} results for "${query}"`}
            </DialogDescription>
          </DialogHeader>

          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">All ({totalResults})</TabsTrigger>
                <TabsTrigger value="devices">Devices ({results.devices.length})</TabsTrigger>
                <TabsTrigger value="flows">Flows ({results.flows.length})</TabsTrigger>
                <TabsTrigger value="threats">Threats ({results.threats.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {results.devices.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Devices</h4>
                        <div className="space-y-2">
                          {results.devices.map(device => (
                            <Card
                              key={device.id}
                              className="p-3 cursor-pointer hover:bg-accent/5"
                              onClick={() => {
                                onResultClick?.('device', device.id);
                                setShowResults(false);
                              }}
                            >
                              <p className="font-medium">{device.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">{device.ip}</p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {results.flows.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Flows</h4>
                        <div className="space-y-2">
                          {results.flows.map(flow => (
                            <Card
                              key={flow.id}
                              className="p-3 cursor-pointer hover:bg-accent/5"
                              onClick={() => {
                                onResultClick?.('flow', flow.id);
                                setShowResults(false);
                              }}
                            >
                              <p className="font-mono text-sm">
                                {flow.sourceIp}:{flow.sourcePort} → {flow.destIp}:{flow.destPort}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {flow.protocol} • {formatTimestamp(flow.timestamp)}
                              </p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {results.threats.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Threats</h4>
                        <div className="space-y-2">
                          {results.threats.map(threat => (
                            <Card
                              key={threat.id}
                              className="p-3 cursor-pointer hover:bg-accent/5"
                              onClick={() => {
                                onResultClick?.('threat', threat.id);
                                setShowResults(false);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{threat.type}</p>
                                <Badge
                                  variant={
                                    threat.severity === 'critical' ? 'destructive' : 'outline'
                                  }
                                >
                                  {threat.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {threat.description}
                              </p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {totalResults === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>No results found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="devices" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {results.devices.map(device => (
                      <Card
                        key={device.id}
                        className="p-3 cursor-pointer hover:bg-accent/5"
                        onClick={() => {
                          onResultClick?.('device', device.id);
                          setShowResults(false);
                        }}
                      >
                        <p className="font-medium">{device.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{device.ip}</p>
                        <p className="text-xs text-muted-foreground">{device.type}</p>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="flows" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {results.flows.map(flow => (
                      <Card
                        key={flow.id}
                        className="p-3 cursor-pointer hover:bg-accent/5"
                        onClick={() => {
                          onResultClick?.('flow', flow.id);
                          setShowResults(false);
                        }}
                      >
                        <p className="font-mono text-sm">
                          {flow.sourceIp}:{flow.sourcePort} → {flow.destIp}:{flow.destPort}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {flow.protocol} • {formatBytes(flow.bytesIn + flow.bytesOut)} •{' '}
                          {formatTimestamp(flow.timestamp)}
                        </p>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="threats" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {results.threats.map(threat => (
                      <Card
                        key={threat.id}
                        className="p-3 cursor-pointer hover:bg-accent/5"
                        onClick={() => {
                          onResultClick?.('threat', threat.id);
                          setShowResults(false);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium">{threat.type}</p>
                          <Badge
                            variant={threat.severity === 'critical' ? 'destructive' : 'outline'}
                          >
                            {threat.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{threat.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(threat.timestamp)}
                        </p>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowResults(false)}>
              Close
            </Button>
            <Button onClick={() => setShowResults(true)} disabled={isSearching || !query.trim()}>
              <MagnifyingGlass size={16} className="mr-2" />
              {isSearching ? 'Searching...' : 'Search Again'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
