import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NetworkFlow, Device } from '@/lib/types';
import { Pulse } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlowPipeVisualizationProps {
  readonly flows: NetworkFlow[];
  readonly devices: Device[];
  readonly useApi?: boolean;
}

interface PipeFlow {
  id: string;
  sourceIp: string;
  destIp: string;
  bytesIn: number;
  bytesOut: number;
  protocol: string;
  threatLevel: string;
  timestamp: number;
}

export function FlowPipeVisualization({
  flows,
  devices,
  useApi = false,
}: FlowPipeVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activePipes, setActivePipes] = useState<Map<string, PipeFlow>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<
    Array<{
      pipeKey: string;
      progress: number;
      speed: number;
      size: number;
      color: string;
      direction: 'in' | 'out';
    }>
  >([]);

  useEffect(() => {
    setActivePipes(prevPipes => {
      const newPipes = new Map<string, PipeFlow>();

      flows.slice(0, 15).forEach(flow => {
        const pipeKey = `${flow.sourceIp}-${flow.destIp}`;

        if (prevPipes.has(pipeKey)) {
          const existing = prevPipes.get(pipeKey)!;
          newPipes.set(pipeKey, {
            ...existing,
            bytesIn: existing.bytesIn + flow.bytesIn,
            bytesOut: existing.bytesOut + flow.bytesOut,
            timestamp: flow.timestamp,
          });
        } else {
          newPipes.set(pipeKey, {
            id: flow.id,
            sourceIp: flow.sourceIp,
            destIp: flow.destIp,
            bytesIn: flow.bytesIn,
            bytesOut: flow.bytesOut,
            protocol: flow.protocol,
            threatLevel: flow.threatLevel,
            timestamp: flow.timestamp,
          });
        }
      });

      return newPipes;
    });
  }, [flows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getThreatColor = (level: string): string => {
      switch (level) {
        case 'critical':
          return '#ef4444';
        case 'high':
          return '#f97316';
        case 'medium':
          return '#eab308';
        case 'low':
          return '#3b82f6';
        default:
          return '#10b981';
      }
    };

    const pipes = Array.from(activePipes.entries()).map(([key, pipe], index) => {
      const totalPipes = Math.min(activePipes.size, 15);
      const verticalSpacing = canvas.height / window.devicePixelRatio / (totalPipes + 1);
      const y = (index + 1) * verticalSpacing;

      const throughput = pipe.bytesIn + pipe.bytesOut;
      const pipeThickness = Math.max(4, Math.min(20, Math.log10(throughput + 1) * 3));

      return {
        key,
        pipe,
        y,
        thickness: pipeThickness,
        color: getThreatColor(pipe.threatLevel),
      };
    });

    const addParticles = () => {
      pipes.forEach(({ key, pipe, thickness, color }) => {
        if (Math.random() < 0.3) {
          const particleCount = Math.ceil(thickness / 5);
          for (let i = 0; i < particleCount; i++) {
            particlesRef.current.push({
              pipeKey: key,
              progress: 0,
              speed: 0.005 + Math.random() * 0.01,
              size: 2 + Math.random() * 3,
              color: color,
              direction: Math.random() > 0.5 ? 'in' : 'out',
            });
          }
        }
      });

      if (particlesRef.current.length > 200) {
        particlesRef.current = particlesRef.current.slice(-200);
      }
    };

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      addParticles();

      pipes.forEach(({ key, pipe, y, thickness, color }) => {
        const padding = 60;
        const startX = padding;
        const endX = rect.width - padding;
        const pipeLength = endX - startX;

        ctx.strokeStyle = color + '15';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();

        ctx.strokeStyle = color + '30';
        ctx.lineWidth = thickness * 0.6;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(startX, y, thickness / 2 + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(endX, y, thickness / 2 + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(pipe.sourceIp, startX - 10, y + 4);

        ctx.textAlign = 'left';
        ctx.fillText(pipe.destIp, endX + 10, y + 4);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pipe.protocol, (startX + endX) / 2, y - thickness / 2 - 4);
      });

      particlesRef.current = particlesRef.current.filter(particle => {
        const pipeData = pipes.find(p => p.key === particle.pipeKey);
        if (!pipeData) return false;

        particle.progress += particle.speed;

        if (particle.progress > 1) return false;

        const padding = 60;
        const startX = padding;
        const endX = rect.width - padding;
        const x =
          particle.direction === 'in'
            ? startX + (endX - startX) * particle.progress
            : endX - (endX - startX) * particle.progress;

        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = particle.color;
        ctx.beginPath();
        ctx.arc(x, pipeData.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        const trailLength = 15;
        for (let i = 1; i <= trailLength; i++) {
          const trailProgress = particle.progress - i * 0.01;
          if (trailProgress < 0) continue;

          const trailX =
            particle.direction === 'in'
              ? startX + (endX - startX) * trailProgress
              : endX - (endX - startX) * trailProgress;

          const alpha = (1 - i / trailLength) * 0.5;
          ctx.fillStyle =
            particle.color +
            Math.floor(alpha * 255)
              .toString(16)
              .padStart(2, '0');
          ctx.beginPath();
          ctx.arc(trailX, pipeData.y, particle.size * (1 - i / trailLength), 0, Math.PI * 2);
          ctx.fill();
        }

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
  }, [activePipes]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pulse className="text-accent" size={20} />
          Network Flow Pipes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Live traffic visualization showing data flow between sources and destinations
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative w-full" style={{ height: '500px' }}>
          <canvas ref={canvasRef} className="w-full h-full" style={{ background: 'transparent' }} />

          <AnimatePresence>
            {activePipes.size === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="text-center">
                  <Pulse size={48} className="text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">Waiting for network traffic...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-muted-foreground">Safe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Critical</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
