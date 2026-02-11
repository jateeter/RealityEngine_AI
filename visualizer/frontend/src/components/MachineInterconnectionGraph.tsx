/**
 * MachineInterconnectionGraph - Enhanced D3.js visualization with perceptual space integration
 *
 * Shows machines as nodes with:
 * - Tooltips on hover with metadata and status
 * - Real-time perceptual space updates
 * - Internal machine status visualization
 * - Preception cycle indicators
 */

import React, { useEffect, useRef, useState } from 'react';
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
  sequenceCount?: number;
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
  sequenceCount?: number;
  // Runtime status
  status?: 'idle' | 'processing' | 'active';
  lastInput?: number[];
  lastOutput?: number[];
}

interface MachineLink {
  source: string | MachineNode;
  target: string | MachineNode;
  sourceRegion: { offset: number; length: number };
  targetRegion: { offset: number; length: number };
  overlapSize: number;
}

interface PerceptualSpaceUpdate {
  stepNumber: number;
  perceptualSpace: number[];
  machineResults: Record<string, {
    machineId: string;
    machineName: string;
    inputVector: number[];
    outputVector: number[] | null;
  }>;
}

interface MachineInterconnectionGraphProps {
  currentMachineId: string;
  machines: Machine[];
}

export const MachineInterconnectionGraph: React.FC<MachineInterconnectionGraphProps> = ({
  currentMachineId,
  machines
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [perceptualSpace, setPerceptualSpace] = useState<number[]>([]);
  const [machineStatuses, setMachineStatuses] = useState<Record<string, {
    status: 'idle' | 'processing' | 'active';
    lastInput?: number[];
    lastOutput?: number[];
  }>>({});
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Track container size with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Listen for WebSocket updates for perceptual space
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'perceptual-simulation-stepped') {
        const update: PerceptualSpaceUpdate = data.step;
        setCurrentStep(update.stepNumber);
        setPerceptualSpace(update.perceptualSpace);

        // Update machine statuses
        const newStatuses: Record<string, any> = {};
        Object.entries(update.machineResults).forEach(([machineId, result]) => {
          newStatuses[machineId] = {
            status: result.outputVector ? 'active' : 'processing',
            lastInput: result.inputVector,
            lastOutput: result.outputVector || undefined
          };
        });
        setMachineStatuses(newStatuses);
      } else if (data.type === 'perceptual-simulation-reset') {
        setPerceptualSpace([]);
        setMachineStatuses({});
        setCurrentStep(0);
      }
    };

    const ws = (window as any).realityEngineWS;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => {
        ws.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current || !machines || machines.length === 0) return;

    const { width, height } = dimensions;

    // Filter machines that have perceptual mappings
    const validMachines = machines.filter(m => m.perceptualMapping);

    if (validMachines.length === 0) {
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

    // Determine connections
    const currentMachine = validMachines.find(m => m.id === currentMachineId);
    const connectedMachineIds = new Set<string>();

    if (currentMachine && currentMachine.perceptualMapping) {
      const { input: currentInput, output: currentOutput } = currentMachine.perceptualMapping;

      validMachines.forEach(m => {
        if (m.id === currentMachineId || !m.perceptualMapping) return;

        const { input: mInput, output: mOutput } = m.perceptualMapping;
        const currentOutputEnd = currentOutput.offset + currentOutput.length;
        const mInputEnd = mInput.offset + mInput.length;
        const outputToInput = !(currentOutputEnd <= mInput.offset || currentOutput.offset >= mInputEnd);

        const mOutputEnd = mOutput.offset + mOutput.length;
        const currentInputEnd = currentInput.offset + currentInput.length;
        const inputFromOutput = !(mOutputEnd <= currentInput.offset || mOutput.offset >= currentInputEnd);

        if (outputToInput || inputFromOutput) {
          connectedMachineIds.add(m.id);
        }
      });
    }

    // Convert machines to nodes with status
    const nodes: MachineNode[] = validMachines.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      inputMapping: m.perceptualMapping!.input,
      outputMapping: m.perceptualMapping!.output,
      isCurrent: m.id === currentMachineId,
      isConnected: m.id === currentMachineId || connectedMachineIds.has(m.id),
      metadata: m.metadata,
      sequenceCount: m.sequenceCount,
      status: machineStatuses[m.id]?.status || 'idle',
      lastInput: machineStatuses[m.id]?.lastInput,
      lastOutput: machineStatuses[m.id]?.lastOutput
    }));

    // Detect links
    const links: MachineLink[] = [];
    for (let i = 0; i < validMachines.length; i++) {
      const sourceM = validMachines[i];
      if (!sourceM || !sourceM.perceptualMapping) continue;

      for (let j = 0; j < validMachines.length; j++) {
        if (i === j) continue;
        const targetM = validMachines[j];
        if (!targetM || !targetM.perceptualMapping) continue;

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

    // Add zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom as any);

    // Create simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(250))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(120))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // Draw links
    const link = g.append('g').attr('class', 'links').selectAll('g').data(links).join('g');

    const linkPath = link.append('path')
      .attr('class', 'link-path')
      .attr('fill', 'none')
      .attr('stroke', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        if (sourceNode?.isCurrent || targetNode?.isCurrent) return '#3b82f6';
        if (sourceNode?.isConnected && targetNode?.isConnected) return '#64748b';
        return '#334155';
      })
      .attr('stroke-width', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        return (sourceNode?.isCurrent || targetNode?.isCurrent) ? 3 : 2;
      })
      .attr('opacity', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        return (!sourceNode?.isConnected || !targetNode?.isConnected) ? 0.2 : 0.7;
      })
      .attr('marker-end', (d: MachineLink) => {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        return (sourceNode?.isCurrent || targetNode?.isCurrent) ? 'url(#arrowhead-active)' : 'url(#arrowhead)';
      });

    // Arrowheads
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
    const node = g.append('g').attr('class', 'nodes').selectAll('g').data(nodes).join('g')
      .attr('class', 'node')
      .call(d3.drag<any, MachineNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Node rectangles
    node.append('rect')
      .attr('width', 200)
      .attr('height', 140)
      .attr('x', -100)
      .attr('y', -70)
      .attr('rx', 10)
      .attr('fill', (d: MachineNode) => {
        if (d.status === 'active') return '#166534'; // Green for active
        if (d.status === 'processing') return '#854d0e'; // Yellow for processing
        if (d.isCurrent) return '#1e40af';
        if (d.isConnected) return '#475569';
        return '#1e293b';
      })
      .attr('stroke', (d: MachineNode) => {
        if (d.status === 'active') return '#22c55e';
        if (d.status === 'processing') return '#eab308';
        if (d.isCurrent) return '#3b82f6';
        if (d.isConnected) return '#64748b';
        return '#334155';
      })
      .attr('stroke-width', (d: MachineNode) => d.isCurrent ? 3 : 2)
      .attr('opacity', (d: MachineNode) => d.isConnected ? 1 : 0.4)
      .on('mouseover', showTooltip)
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);

    // Current machine indicator
    node.filter((d: MachineNode) => d.isCurrent)
      .append('rect')
      .attr('width', 210)
      .attr('height', 150)
      .attr('x', -105)
      .attr('y', -75)
      .attr('rx', 12)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6);

    // Machine name
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -40)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', (d: MachineNode) => d.isCurrent ? '#93c5fd' : '#e2e8f0')
      .text((d: MachineNode) => {
        const maxLen = 20;
        return d.name.length > maxLen ? d.name.substring(0, maxLen) + '...' : d.name;
      });

    // Status indicator
    node.append('circle')
      .attr('cx', 85)
      .attr('cy', -60)
      .attr('r', 6)
      .attr('fill', (d: MachineNode) => {
        if (d.status === 'active') return '#22c55e';
        if (d.status === 'processing') return '#eab308';
        return '#64748b';
      })
      .attr('opacity', 0.8);

    // Input mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -18)
      .attr('font-size', '11px')
      .attr('fill', '#60a5fa')
      .text((d: MachineNode) => `In: [${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length}]`);

    // Output mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -3)
      .attr('font-size', '11px')
      .attr('fill', '#f472b6')
      .text((d: MachineNode) => `Out: [${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length}]`);

    // Last input vector (if available)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 15)
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .text((d: MachineNode) => {
        if (d.lastInput && d.lastInput.length > 0) {
          const preview = d.lastInput.slice(0, 4).map(v => v.toFixed(1)).join(',');
          return `In: [${preview}${d.lastInput.length > 4 ? '...' : ''}]`;
        }
        return '';
      });

    // Last output vector (if available)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 30)
      .attr('font-size', '9px')
      .attr('fill', '#f9a8d4')
      .text((d: MachineNode) => {
        if (d.lastOutput && d.lastOutput.length > 0) {
          const preview = d.lastOutput.slice(0, 4).map(v => v.toFixed(1)).join(',');
          return `Out: [${preview}${d.lastOutput.length > 4 ? '...' : ''}]`;
        }
        return '';
      });

    // Sequence count
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 50)
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text((d: MachineNode) => d.sequenceCount ? `${d.sequenceCount} sequences` : '');

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

    // Tooltip functions
    function showTooltip(event: any, d: MachineNode) {
      if (!tooltipRef.current) return;

      const tooltip = d3.select(tooltipRef.current);
      tooltip.style('display', 'block');

      let content = `
        <div class="tooltip-title">${d.name}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Status:</span>
          <span class="tooltip-value">${d.status || 'idle'}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Description:</span>
          <span class="tooltip-value">${d.description}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Input Region:</span>
          <span class="tooltip-value">[${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length}]</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Output Region:</span>
          <span class="tooltip-value">[${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length}]</span>
        </div>
      `;

      if (d.sequenceCount) {
        content += `
          <div class="tooltip-row">
            <span class="tooltip-label">Sequences:</span>
            <span class="tooltip-value">${d.sequenceCount}</span>
          </div>
        `;
      }

      if (d.metadata) {
        const metaKeys = Object.keys(d.metadata);
        if (metaKeys.length > 0) {
          content += `<div class="tooltip-row"><span class="tooltip-label">Metadata:</span></div>`;
          metaKeys.slice(0, 3).forEach(key => {
            content += `
              <div class="tooltip-row" style="margin-left: 10px;">
                <span class="tooltip-label">${key}:</span>
                <span class="tooltip-value">${JSON.stringify(d.metadata![key]).substring(0, 30)}</span>
              </div>
            `;
          });
        }
      }

      if (d.lastInput && d.lastInput.length > 0) {
        content += `
          <div class="tooltip-row">
            <span class="tooltip-label">Last Input:</span>
            <span class="tooltip-value">[${d.lastInput.map(v => v.toFixed(2)).join(', ')}]</span>
          </div>
        `;
      }

      if (d.lastOutput && d.lastOutput.length > 0) {
        content += `
          <div class="tooltip-row">
            <span class="tooltip-label">Last Output:</span>
            <span class="tooltip-value">[${d.lastOutput.map(v => v.toFixed(2)).join(', ')}]</span>
          </div>
        `;
      }

      tooltip.html(content);
      moveTooltip(event);
    }

    function moveTooltip(event: any) {
      if (!tooltipRef.current) return;
      const tooltip = d3.select(tooltipRef.current);
      tooltip
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    }

    function hideTooltip() {
      if (!tooltipRef.current) return;
      d3.select(tooltipRef.current).style('display', 'none');
    }

    // Cleanup
    return () => {
      simulation.stop();
    };

  }, [machines, currentMachineId, dimensions, machineStatuses, perceptualSpace]);

  return (
    <div ref={containerRef} className="machine-interconnection-graph">
      <svg ref={svgRef} className="graph-svg"></svg>

      {/* Enhanced tooltip */}
      <div ref={tooltipRef} className="node-tooltip" style={{ display: 'none' }}></div>

      {/* Perceptual space status indicator */}
      {perceptualSpace.length > 0 && (
        <div className="perceptual-status">
          <div className="status-header">
            <span className="status-title">Perceptual Space (En)</span>
            <span className="status-step">Step: {currentStep}</span>
          </div>
          <div className="status-info">
            <span>{perceptualSpace.length}D vector</span>
            <span>Non-zero: {perceptualSpace.filter(v => v !== 0).length}</span>
          </div>
        </div>
      )}

      {/* Enhanced legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-box current-machine"></div>
          <span>Current Machine</span>
        </div>
        <div className="legend-item">
          <div className="legend-box connected-machine"></div>
          <span>Connected</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: '#166534', borderColor: '#22c55e' }}></div>
          <span>Active (Output)</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: '#854d0e', borderColor: '#eab308' }}></div>
          <span>Processing</span>
        </div>
        <div className="legend-item">
          <div className="legend-box disconnected-machine"></div>
          <span>Idle</span>
        </div>
        <div className="legend-item">
          <div className="legend-arrow"></div>
          <span>Data Flow</span>
        </div>
      </div>

      <div className="graph-controls">
        <div className="control-hint">
          💡 Hover nodes for details • Drag to rearrange • Scroll to zoom
        </div>
      </div>
    </div>
  );
};
