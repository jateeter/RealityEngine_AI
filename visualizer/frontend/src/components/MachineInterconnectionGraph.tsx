/**
 * MachineInterconnectionGraph - D3.js visualization of interconnected machines
 *
 * Shows machines as nodes with connections based on perceptual space
 * input/output overlaps. Highlights the current machine and its connections.
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './MachineInterconnectionGraph.css';

interface Machine {
  id: string;
  name: string;
  description: string;
  perceptualMapping?: {
    input: { offset: number; length: number };
    output: { offset: number; length: number };
  };
  metadata?: Record<string, any>;
}

interface MachineNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  description: string;
  inputMapping: { offset: number; length: number };
  outputMapping: { offset: number; length: number };
  isCurrent: boolean;
  isConnected: boolean;
  metadata?: Record<string, any>;
}

interface MachineLink {
  source: string | MachineNode;
  target: string | MachineNode;
  sourceRegion: { offset: number; length: number };
  targetRegion: { offset: number; length: number };
  overlapSize: number;
}

interface MachineInterconnectionGraphProps {
  currentMachineId: string;
  machines: Machine[];
  width?: number;
  height?: number;
}

export const MachineInterconnectionGraph: React.FC<MachineInterconnectionGraphProps> = ({
  currentMachineId,
  machines,
  width = 1200,
  height = 700
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !machines || machines.length === 0) return;

    // Filter machines that have perceptual mappings
    const validMachines = machines.filter(m => m.perceptualMapping);

    if (validMachines.length === 0) {
      // Show message if no machines with mappings
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '16px')
        .text('No machines with perceptual mappings configured');

      return;
    }

    // Determine which machines are connected to the current machine
    const currentMachine = validMachines.find(m => m.id === currentMachineId);
    const connectedMachineIds = new Set<string>();

    if (currentMachine && currentMachine.perceptualMapping) {
      const { input: currentInput, output: currentOutput } = currentMachine.perceptualMapping;

      validMachines.forEach(m => {
        if (m.id === currentMachineId || !m.perceptualMapping) return;

        const { input: mInput, output: mOutput } = m.perceptualMapping;

        // Check if current machine's output overlaps with m's input
        const currentOutputEnd = currentOutput.offset + currentOutput.length;
        const mInputEnd = mInput.offset + mInput.length;
        const outputToInput = !(currentOutputEnd <= mInput.offset || currentOutput.offset >= mInputEnd);

        // Check if m's output overlaps with current machine's input
        const mOutputEnd = mOutput.offset + mOutput.length;
        const currentInputEnd = currentInput.offset + currentInput.length;
        const inputFromOutput = !(mOutputEnd <= currentInput.offset || mOutput.offset >= currentInputEnd);

        if (outputToInput || inputFromOutput) {
          connectedMachineIds.add(m.id);
        }
      });
    }

    // Convert machines to nodes
    const nodes: MachineNode[] = validMachines.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      inputMapping: m.perceptualMapping!.input,
      outputMapping: m.perceptualMapping!.output,
      isCurrent: m.id === currentMachineId,
      isConnected: m.id === currentMachineId || connectedMachineIds.has(m.id),
      metadata: m.metadata
    }));

    // Detect connections based on overlapping regions
    const links: MachineLink[] = [];

    for (let i = 0; i < validMachines.length; i++) {
      const sourceM = validMachines[i];
      if (!sourceM || !sourceM.perceptualMapping) continue;

      for (let j = 0; j < validMachines.length; j++) {
        if (i === j) continue;
        const targetM = validMachines[j];
        if (!targetM || !targetM.perceptualMapping) continue;

        // Check if source's output region overlaps with target's input region
        const sourceOutput = sourceM.perceptualMapping.output;
        const targetInput = targetM.perceptualMapping.input;

        const sourceEnd = sourceOutput.offset + sourceOutput.length;
        const targetEnd = targetInput.offset + targetInput.length;

        const overlapStart = Math.max(sourceOutput.offset, targetInput.offset);
        const overlapEnd = Math.min(sourceEnd, targetEnd);

        if (overlapStart < overlapEnd) {
          const overlapSize = overlapEnd - overlapStart;
          links.push({
            source: sourceM.id,
            target: targetM.id,
            sourceRegion: sourceOutput,
            targetRegion: targetInput,
            overlapSize
          });
        }
      }
    }

    // Clear previous visualization
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(250))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(120))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('g')
      .data(links)
      .join('g');

    // Link paths
    const linkPath = link.append('path')
      .attr('class', 'link-path')
      .attr('fill', 'none')
      .attr('stroke', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));

        if (sourceNode?.isCurrent || targetNode?.isCurrent) {
          return '#3b82f6';
        }
        if (sourceNode?.isConnected && targetNode?.isConnected) {
          return '#64748b';
        }
        return '#334155';
      })
      .attr('stroke-width', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));

        if (sourceNode?.isCurrent || targetNode?.isCurrent) {
          return 3;
        }
        return 2;
      })
      .attr('opacity', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));

        if (!sourceNode?.isConnected || !targetNode?.isConnected) {
          return 0.2;
        }
        return 0.7;
      })
      .attr('marker-end', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));

        if (sourceNode?.isCurrent || targetNode?.isCurrent) {
          return 'url(#arrowhead-active)';
        }
        return 'url(#arrowhead)';
      });

    // Add arrowhead markers
    svg.append('defs').selectAll('marker')
      .data(['arrowhead', 'arrowhead-active'])
      .join('marker')
      .attr('id', markerType => markerType)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', markerType => markerType === 'arrowhead-active' ? '#3b82f6' : '#64748b');

    // Link labels
    const linkLabel = link.append('text')
      .attr('class', 'link-label')
      .attr('font-size', '10px')
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .text((d: MachineLink) =>
        `[${d.sourceRegion.offset}:${d.sourceRegion.offset + d.sourceRegion.length}] → [${d.targetRegion.offset}:${d.targetRegion.offset + d.targetRegion.length}]`
      );

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag<any, MachineNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Node rectangles
    node.append('rect')
      .attr('width', 200)
      .attr('height', 120)
      .attr('x', -100)
      .attr('y', -60)
      .attr('rx', 10)
      .attr('fill', (d: MachineNode) => {
        if (d.isCurrent) return '#1e40af';
        if (d.isConnected) return '#475569';
        return '#1e293b';
      })
      .attr('stroke', (d: MachineNode) => {
        if (d.isCurrent) return '#3b82f6';
        if (d.isConnected) return '#64748b';
        return '#334155';
      })
      .attr('stroke-width', (d: MachineNode) => d.isCurrent ? 3 : 2)
      .attr('opacity', (d: MachineNode) => d.isConnected ? 1 : 0.4);

    // Current machine indicator
    node.filter((d: MachineNode) => d.isCurrent)
      .append('rect')
      .attr('width', 210)
      .attr('height', 130)
      .attr('x', -105)
      .attr('y', -65)
      .attr('rx', 12)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6);

    // Machine name
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -30)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', (d: MachineNode) => d.isCurrent ? '#93c5fd' : '#e2e8f0')
      .text((d: MachineNode) => {
        const maxLen = 20;
        return d.name.length > maxLen ? d.name.substring(0, maxLen) + '...' : d.name;
      });

    // Input mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -10)
      .attr('font-size', '11px')
      .attr('fill', '#60a5fa')
      .text((d: MachineNode) => `In: [${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length}]`);

    // Output mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 5)
      .attr('font-size', '11px')
      .attr('fill', '#f472b6')
      .text((d: MachineNode) => `Out: [${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length}]`);

    // Category badge (if available)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 25)
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .text((d: MachineNode) => {
        const category = d.metadata?.category;
        return category ? `[${category}]` : '';
      });

    // Sequence count (reserved for future use)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 45)
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(() => '');

    // Update simulation
    simulation.on('tick', () => {
      linkPath.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: MachineNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: MachineNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: MachineNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };

  }, [machines, currentMachineId, width, height]);

  return (
    <div className="machine-interconnection-graph">
      <svg ref={svgRef} className="graph-svg"></svg>

      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-box current-machine"></div>
          <span>Current Machine</span>
        </div>
        <div className="legend-item">
          <div className="legend-box connected-machine"></div>
          <span>Connected Machine</span>
        </div>
        <div className="legend-item">
          <div className="legend-box disconnected-machine"></div>
          <span>Other Machine</span>
        </div>
        <div className="legend-item">
          <div className="legend-arrow"></div>
          <span>Data Flow (Output → Input)</span>
        </div>
      </div>

      <div className="graph-controls">
        <div className="control-hint">
          💡 Drag nodes to rearrange • Scroll to zoom • Click to select
        </div>
      </div>
    </div>
  );
};
