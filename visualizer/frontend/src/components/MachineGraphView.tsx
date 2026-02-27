/**
 * MachineGraphView - Visualization of machines as computational nodes
 *
 * Shows machines with their perceptual space input/output mappings
 * and visualizes the flow of data through the system.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useVisualizerStore } from '../store';
import './MachineGraphView.css';

interface MachineNode {
  id: string;
  name: string;
  description: string;
  inputMapping: { offset: number; length: number };
  outputMapping: { offset: number; length: number };
  metadata: Record<string, any>;
}

interface MachineEdge {
  source: string;
  target: string;
  sourceRegion: { offset: number; length: number };
  targetRegion: { offset: number; length: number };
  overlap: boolean;
}

interface MachineGraphData {
  nodes: MachineNode[];
  edges: MachineEdge[];
  perceptualSpaceDimension: number;
}

interface SimulationStep {
  stepNumber: number;
  timestamp: number;
  perceptualSpace: number[];
  machineResults: Record<string, {
    machineId: string;
    machineName: string;
    inputVector: number[];
    outputVector: number[] | null;
    inputRegion: { offset: number; length: number };
    outputRegion: { offset: number; length: number } | null;
  }>;
  activeRegions: Array<{
    offset: number;
    length: number;
    machineId: string;
    type: 'input' | 'output';
  }>;
}

export const MachineGraphView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<MachineGraphData | null>(null);
  const [currentStep, setCurrentStep] = useState<SimulationStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 });
  const ws = useVisualizerStore(state => state.ws);

  // Fetch machine graph data
  const fetchGraphData = useCallback(async () => {
    try {
      const response = await fetch('/api/machine-graph');
      const result = await response.json();

      if (result.success) {
        setGraphData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load machine graph');
      }
    } catch (err: any) {
      setError(`Error fetching graph data: ${err.message}`);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Observe container size for responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height: Math.max(height - 140, 400) }); // Account for header and legend
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Listen for WebSocket updates from the store's shared connection
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'perceptual-simulation-stepped') {
        setCurrentStep(data.step);
      } else if (data.type === 'perceptual-simulation-reset') {
        setCurrentStep(null);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  // Render the graph
  useEffect(() => {
    if (!svgRef.current || !graphData || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes as any)
      .force('link', d3.forceLink(graphData.edges)
        .id((d: any) => d.id)
        .distance(200))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(80));

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(graphData.edges)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6);

    // Draw edge labels
    const linkLabels = g.append('g')
      .selectAll('text')
      .data(graphData.edges)
      .join('text')
      .attr('class', 'edge-label')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text((d: MachineEdge) => `[${d.sourceRegion.offset}:${d.sourceRegion.offset + d.sourceRegion.length}] → [${d.targetRegion.offset}:${d.targetRegion.offset + d.targetRegion.length}]`);

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node rectangles
    node.append('rect')
      .attr('width', 160)
      .attr('height', 100)
      .attr('x', -80)
      .attr('y', -50)
      .attr('rx', 8)
      .attr('fill', (d: MachineNode) => {
        // Highlight if active in current step
        if (currentStep?.machineResults[d.id]) {
          return '#4a90e2';
        }
        return '#6a7485';
      })
      .attr('stroke', '#333')
      .attr('stroke-width', 2);

    // Machine name
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -20)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text((d: MachineNode) => d.name);

    // Input mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 0)
      .attr('font-size', '11px')
      .attr('fill', '#a8dadc')
      .text((d: MachineNode) => `In: [${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length}]`);

    // Output mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 15)
      .attr('font-size', '11px')
      .attr('fill', '#f1a1c1')
      .text((d: MachineNode) => `Out: [${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length}]`);

    // Current values (if in simulation)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 35)
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text((d: MachineNode) => {
        if (currentStep?.machineResults[d.id]) {
          const result = currentStep.machineResults[d.id];
          if (result && result.outputVector) {
            return `Output: [${result.outputVector.join(', ')}]`;
          }
        }
        return '';
      });

    // Update simulation
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
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

    // Cleanup: stop simulation on unmount or when dependencies change
    return () => {
      simulation.stop();
    };
  }, [graphData, currentStep, dimensions]);

  if (error) {
    return (
      <div className="machine-graph-view error">
        <h2>Machine Graph View</h2>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="machine-graph-view loading">
        <h2>Machine Graph View</h2>
        <div>Loading machine graph...</div>
      </div>
    );
  }

  return (
    <div className="machine-graph-view" ref={containerRef}>
      <div className="graph-header">
        <h2>Machine Graph View</h2>
        <div className="graph-info">
          <span>Machines: {graphData.nodes.length}</span>
          <span>Connections: {graphData.edges.length}</span>
          <span>Perceptual Space: {graphData.perceptualSpaceDimension}D</span>
          {currentStep && (
            <span className="step-indicator">Step: {currentStep.stepNumber}</span>
          )}
        </div>
      </div>

      <svg ref={svgRef} className="machine-graph-svg"></svg>

      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#6a7485' }}></div>
          <span>Inactive Machine</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#4a90e2' }}></div>
          <span>Active Machine</span>
        </div>
        <div className="legend-item">
          <div className="legend-line"></div>
          <span>Data Flow</span>
        </div>
      </div>
    </div>
  );
};
