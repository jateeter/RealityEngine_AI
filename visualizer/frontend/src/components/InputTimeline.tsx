import React, { useRef, useEffect, useState } from 'react';
import { useVisualizerStore } from '../store';

interface TimelineProps {
  height?: number;
}

const InputTimeline: React.FC<TimelineProps> = ({ height = 80 }) => {
  const {
    inputVectors,
    simulationState,
    stepSimulation
  } = useVisualizerStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const currentIndex = simulationState?.currentIndex ?? 0;
  const totalVectors = inputVectors.length;

  // Auto-scroll to current position
  useEffect(() => {
    if (containerRef.current && totalVectors > 0) {
      const container = containerRef.current;
      const markerWidth = 8 * zoom;
      const markerGap = 4 * zoom;
      const markerTotal = markerWidth + markerGap;
      const currentPosition = currentIndex * markerTotal;
      const containerWidth = container.clientWidth;

      // Scroll to keep current marker in view
      const scrollLeft = currentPosition - containerWidth / 2;
      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }, [currentIndex, totalVectors, zoom]);

  const handleMarkerClick = async (index: number) => {
    if (!simulationState || simulationState.status === 'playing') {
      return;
    }

    // Step to the clicked position
    const stepsNeeded = index - currentIndex;
    if (stepsNeeded > 0) {
      for (let i = 0; i < stepsNeeded; i++) {
        await stepSimulation();
      }
    }
  };

  const getMarkerColor = (index: number): string => {
    if (index === currentIndex) {
      return 'bg-blue-500';
    }
    if (index < currentIndex) {
      return 'bg-gray-600';
    }

    // Color-code by vector properties (simplified)
    // In a real implementation, you'd analyze the vector values
    const hash = index % 7;
    const colors = [
      'bg-green-400',   // Normal
      'bg-green-400',   // Normal
      'bg-yellow-400',  // Warning
      'bg-yellow-400',  // Warning
      'bg-orange-400',  // Critical
      'bg-purple-400',  // Maintenance
      'bg-red-400'      // Emergency/Anomaly
    ];
    return colors[hash];
  };

  const getMarkerTooltip = (index: number): string => {
    if (!inputVectors[index]) return `Vector ${index}`;

    const vector = inputVectors[index];
    const preview = vector.slice(0, 3).map(v => v.toFixed(2)).join(', ');
    return `Vector ${index}: [${preview}...]`;
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.5, 3));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.5, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  if (!totalVectors) {
    return (
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="text-center text-gray-500 text-sm">
          No input vectors loaded
        </div>
      </div>
    );
  }

  const markerWidth = 8 * zoom;
  const markerGap = 4 * zoom;
  const timelineWidth = totalVectors * (markerWidth + markerGap);

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="text-sm text-gray-400">
          Input Timeline ({totalVectors} vectors)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            title="Reset Zoom"
          >
            1:1
          </button>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: `${height}px` }}
      >
        <div
          ref={timelineRef}
          className="relative h-full flex items-center gap-1 px-4"
          style={{ width: `${timelineWidth + 32}px` }}
        >
          {inputVectors.map((_, index) => (
            <div
              key={index}
              className="relative flex flex-col items-center justify-center"
              style={{ width: `${markerWidth}px` }}
            >
              {/* Marker */}
              <div
                className={`
                  ${getMarkerColor(index)}
                  ${index === currentIndex ? 'ring-2 ring-white shadow-lg' : ''}
                  ${index < currentIndex ? 'opacity-60' : ''}
                  rounded-full cursor-pointer transition-all duration-200
                  hover:scale-125 hover:shadow-lg
                `}
                style={{
                  width: `${markerWidth}px`,
                  height: `${markerWidth}px`
                }}
                onClick={() => handleMarkerClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                title={getMarkerTooltip(index)}
              />

              {/* Current Position Indicator */}
              {index === currentIndex && (
                <div className="absolute -bottom-2 flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-blue-500" />
                  <div className="text-xs text-blue-400 font-semibold whitespace-nowrap">
                    {currentIndex}
                  </div>
                </div>
              )}

              {/* Tooltip on hover */}
              {hoveredIndex === index && (
                <div className="absolute -top-12 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap z-10 shadow-lg">
                  {getMarkerTooltip(index)}
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 rotate-45" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-gray-700 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-gray-400">Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-yellow-400 rounded-full" />
          <span className="text-gray-400">Warning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-orange-400 rounded-full" />
          <span className="text-gray-400">Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-purple-400 rounded-full" />
          <span className="text-gray-400">Maintenance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-400 rounded-full" />
          <span className="text-gray-400">Emergency</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white" />
          <span className="text-gray-400">Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-gray-600 rounded-full" />
          <span className="text-gray-400">Processed</span>
        </div>
      </div>
    </div>
  );
};

export default InputTimeline;
