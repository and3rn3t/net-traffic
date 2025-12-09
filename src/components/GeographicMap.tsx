import { useEffect, useRef, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { NetworkFlow } from '@/lib/types';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface GeographicMapProps {
  readonly flows: NetworkFlow[];
  readonly hours?: number;
  readonly useApi?: boolean;
}

interface ConnectionPoint {
  x: number;
  y: number;
  country: string;
  city?: string;
  asn?: number;
  count: number;
  threatLevel: string;
  pulsePhase: number;
}

export function GeographicMap({ flows, hours = 24, useApi = false }: GeographicMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [points, setPoints] = useState<ConnectionPoint[]>([]);
  const { useRealApi } = useApiConfig();
  const { geographicStats, isLoading, error, fetchGeographicStats } = useEnhancedAnalytics({
    autoFetch: useApi && useRealApi,
    hours,
  });

  // Prepare geographic data from API or flows
  const geographicData = useMemo(() => {
    const countryMap = new Map<
      string,
      {
        count: number;
        threatLevel: string;
        city?: string;
        asn?: number;
      }
    >();

    // Use API data if available
    if (useRealApi && useApi && geographicStats.length > 0) {
      geographicStats.forEach(stat => {
        const key = stat.country;
        const existing = countryMap.get(key);
        if (existing) {
          existing.count += stat.connections;
          if (stat.threats > 0) {
            existing.threatLevel = 'high';
          }
        } else {
          countryMap.set(key, {
            count: stat.connections,
            threatLevel: stat.threats > 0 ? 'high' : 'low',
          });
        }
      });
    } else {
      // Fallback: calculate from flows
      flows.forEach(flow => {
        if (flow.country) {
          const key = flow.city ? `${flow.country}-${flow.city}` : flow.country;
          const existing = countryMap.get(key);
          if (existing) {
            existing.count++;
            if (flow.threatLevel === 'high' || flow.threatLevel === 'critical') {
              existing.threatLevel = flow.threatLevel;
            }
          } else {
            countryMap.set(key, {
              count: 1,
              threatLevel: flow.threatLevel,
              city: flow.city,
              asn: flow.asn,
            });
          }
        }
      });
    }

    return countryMap;
  }, [flows, useRealApi, useApi, geographicStats]);

  useEffect(() => {
    const getCoordinates = (country: string): { x: number; y: number } => {
      const coords: Record<string, { lat: number; lon: number }> = {
        US: { lat: 37.09, lon: -95.71 },
        UK: { lat: 55.37, lon: -3.43 },
        DE: { lat: 51.16, lon: 10.45 },
        FR: { lat: 46.22, lon: 2.21 },
        JP: { lat: 36.2, lon: 138.25 },
        CN: { lat: 35.86, lon: 104.19 },
        IN: { lat: 20.59, lon: 78.96 },
        BR: { lat: -14.23, lon: -51.92 },
        AU: { lat: -25.27, lon: 133.77 },
        CA: { lat: 56.13, lon: -106.34 },
        RU: { lat: 61.52, lon: 105.31 },
        SG: { lat: 1.35, lon: 103.81 },
      };

      const coord = coords[country] || { lat: 0, lon: 0 };
      const x = (coord.lon + 180) / 360;
      const y = (90 - coord.lat) / 180;

      return { x, y };
    };

    const newPoints: ConnectionPoint[] = [];
    geographicData.forEach((data, key) => {
      // Extract country from key (format: "COUNTRY" or "COUNTRY-CITY")
      const country = key.split('-')[0];
      const { x, y } = getCoordinates(country);
      newPoints.push({
        x,
        y,
        country,
        city: data.city,
        asn: data.asn,
        count: data.count,
        threatLevel: data.threatLevel,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    });

    setPoints(newPoints);
  }, [geographicData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getThreatColor = (level: string): string => {
      switch (level) {
        case 'critical':
          return 'rgba(239, 68, 68, ';
        case 'high':
          return 'rgba(249, 115, 22, ';
        case 'medium':
          return 'rgba(234, 179, 8, ';
        case 'low':
          return 'rgba(59, 130, 246, ';
        default:
          return 'rgba(16, 185, 129, ';
      }
    };

    let time = 0;

    const animate = () => {
      time += 0.02;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const gridSize = 40;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < rect.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
      for (let y = 0; y < rect.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }

      points.forEach((point, index) => {
        const x = point.x * rect.width;
        const y = point.y * rect.height;

        if (index > 0) {
          const prevPoint = points[index - 1];
          const prevX = prevPoint.x * rect.width;
          const prevY = prevPoint.y * rect.height;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const pulse = Math.sin(time + point.pulsePhase) * 0.5 + 0.5;
        const baseRadius = 5 + Math.log(point.count + 1) * 3;
        const radius = baseRadius + pulse * 4;

        ctx.beginPath();
        ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
        const color = getThreatColor(point.threatLevel);
        ctx.fillStyle = color + pulse * 0.2 + ')';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = color + '0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowColor = color + '1)';
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(point.count.toString(), x, y + 3);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(point.country, x, y + baseRadius + 12);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [points]);

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="text-accent" size={20} />
            Geographic Connections
          </CardTitle>
          <p className="text-sm text-muted-foreground">Connection distribution by country</p>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-accent" size={20} />
              Geographic Connections
            </CardTitle>
            <p className="text-sm text-muted-foreground">Connection distribution by country</p>
          </div>
          {useRealApi && useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchGeographicStats(hours)}
              disabled={isLoading}
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
        {error && useRealApi && useApi && (
          <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
            {error}. Using calculated data from flows.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg bg-card/50"
            style={{ height: '400px' }}
          />
          {points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin size={48} className="text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">No geographic data available</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
