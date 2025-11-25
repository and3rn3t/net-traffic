import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightning } from '@phosphor-icons/react';
import { NetworkFlow } from '@/lib/types';

interface PacketBurstProps {
  flows: NetworkFlow[];
}

interface Burst {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  color: string;
  speed: number;
}

export function PacketBurst({ flows }: PacketBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstsRef = useRef<Burst[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastFlowCountRef = useRef(0);

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

    if (flows.length > lastFlowCountRef.current) {
      const newFlows = flows.slice(0, flows.length - lastFlowCountRef.current);
      newFlows.forEach(() => {
        const rect = canvas.getBoundingClientRect();
        const randomFlow = flows[Math.floor(Math.random() * Math.min(20, flows.length))];

        burstsRef.current.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          radius: 0,
          maxRadius: 30 + Math.random() * 40,
          opacity: 1,
          color: getThreatColor(randomFlow?.threatLevel || 'safe'),
          speed: 0.5 + Math.random() * 1.5,
        });
      });

      if (burstsRef.current.length > 50) {
        burstsRef.current = burstsRef.current.slice(-50);
      }
    }
    lastFlowCountRef.current = flows.length;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      burstsRef.current = burstsRef.current.filter(burst => {
        burst.radius += burst.speed;
        burst.opacity = 1 - burst.radius / burst.maxRadius;

        if (burst.radius > burst.maxRadius) return false;

        ctx.beginPath();
        ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
        ctx.strokeStyle = burst.color + burst.opacity * 0.8 + ')';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(burst.x, burst.y, burst.radius * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = burst.color + burst.opacity * 0.5 + ')';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(burst.x, burst.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = burst.color + burst.opacity + ')';
        ctx.shadowBlur = 10;
        ctx.shadowColor = burst.color + '1)';
        ctx.fill();
        ctx.shadowBlur = 0;

        return true;
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
  }, [flows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightning className="text-accent" size={20} />
          Packet Burst Activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Real-time visualization of network packet bursts
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg bg-background/50"
            style={{ height: '300px' }}
          />
          {flows.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Lightning size={48} className="text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">Waiting for packets...</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
