import { Card } from '@/components/ui/card';
import { NetworkFlow, Device } from '@/lib/types';
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface NetworkGraphProps {
  readonly flows: NetworkFlow[];
  readonly devices: Device[];
  readonly useApi?: boolean;
}

interface GraphNode {
  id: string;
  type: 'device' | 'external';
  label: string;
  threatLevel?: string;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  threatLevel: string;
}

export function NetworkGraph({ flows, devices, useApi = false }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || flows.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const nodes: GraphNode[] = [
      ...devices.slice(0, 10).map(d => ({
        id: d.id,
        type: 'device' as const,
        label: d.name,
        threatLevel: d.threatScore > 60 ? 'high' : d.threatScore > 30 ? 'medium' : 'low',
      })),
      ...Array.from(new Set(flows.slice(0, 15).map(f => f.domain || f.destIp))).map(dest => ({
        id: dest,
        type: 'external' as const,
        label: dest,
      })),
    ];

    const links: GraphLink[] = flows
      .slice(0, 20)
      .map(f => ({
        source: f.deviceId,
        target: f.domain || f.destIp,
        value: f.bytesIn + f.bytesOut,
        threatLevel: f.threatLevel,
      }))
      .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target));

    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    const g = svg.append('g');

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => {
        switch (d.threatLevel) {
          case 'critical':
          case 'high':
            return 'oklch(0.55 0.20 25)';
          case 'medium':
            return 'oklch(0.70 0.15 75)';
          case 'low':
            return 'oklch(0.65 0.15 200)';
          default:
            return 'oklch(0.45 0.08 250)';
        }
      })
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.log(d.value + 1) / 3);

    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, any>().on('start', dragstarted).on('drag', dragged).on('end', dragended));

    node
      .append('circle')
      .attr('r', d => (d.type === 'device' ? 20 : 12))
      .attr('fill', d => {
        if (d.type === 'device') {
          switch (d.threatLevel) {
            case 'high':
              return 'oklch(0.55 0.20 25)';
            case 'medium':
              return 'oklch(0.70 0.15 75)';
            default:
              return 'oklch(0.65 0.15 200)';
          }
        }
        return 'oklch(0.45 0.08 250)';
      })
      .attr('stroke', 'oklch(0.98 0.01 250)')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text(d => (d.type === 'device' ? d.label.split(' ')[0] : ''))
      .attr('text-anchor', 'middle')
      .attr('dy', 35)
      .attr('fill', 'oklch(0.75 0.01 250)')
      .attr('font-size', '11px')
      .attr('font-weight', '500');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [flows, devices]);

  return (
    <Card className="p-3 sm:p-4 border border-border/60 bg-card/50 shadow-sm">
      <div className="space-y-3 sm:space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Network Topology</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Real-time connection graph</p>
        </div>
        <svg
          ref={svgRef}
          className="w-full h-[250px] sm:h-[350px] lg:h-[400px] bg-background/50 rounded-lg"
        />
      </div>
    </Card>
  );
}
