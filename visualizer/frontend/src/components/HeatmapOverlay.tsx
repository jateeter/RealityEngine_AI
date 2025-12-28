import React from 'react';
import { useVisualizerStore } from '../store';

const HeatmapOverlay: React.FC = () => {
  const {
    isHeatmapEnabled,
    heatmapData,
    toggleHeatmap
  } = useVisualizerStore();

  // Calculate statistics
  const getHeatmapStats = () => {
    if (heatmapData.length === 0) {
      return {
        total: 0,
        max: 0,
        min: 0,
        avg: 0
      };
    }

    const counts = heatmapData.map(d => d.count);
    const total = counts.reduce((sum, c) => sum + c, 0);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const avg = total / counts.length;

    return { total, max, min, avg: Math.round(avg * 10) / 10 };
  };

  const stats = getHeatmapStats();

  return (
    <div className="absolute top-4 right-4 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl backdrop-blur-sm z-10">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-white">Heatmap</h3>
          <button
            onClick={toggleHeatmap}
            className={`
              px-3 py-1.5 text-xs font-medium rounded transition-all
              ${isHeatmapEnabled
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            {isHeatmapEnabled ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Legend */}
        {isHeatmapEnabled && (
          <>
            <div className="space-y-2">
              <div className="text-xs text-gray-400">Activation Frequency</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-8">Low</span>
                <div className="flex-1 h-4 rounded overflow-hidden flex">
                  <div className="flex-1" style={{ background: 'rgba(59, 130, 246, 0.4)' }} />
                  <div className="flex-1" style={{ background: 'rgba(34, 197, 94, 0.5)' }} />
                  <div className="flex-1" style={{ background: 'rgba(234, 179, 8, 0.6)' }} />
                  <div className="flex-1" style={{ background: 'rgba(239, 68, 68, 0.8)' }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">High</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Blue</span>
                <span>Green</span>
                <span>Yellow</span>
                <span>Red</span>
              </div>
            </div>

            {/* Statistics */}
            {heatmapData.length > 0 && (
              <div className="pt-2 border-t border-gray-700 space-y-1.5">
                <div className="text-xs text-gray-400 mb-2">Statistics</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Vectors:</span>
                    <span className="text-white ml-2 font-semibold">{heatmapData.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Max:</span>
                    <span className="text-white ml-2 font-semibold">{stats.max}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Min:</span>
                    <span className="text-white ml-2 font-semibold">{stats.min}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg:</span>
                    <span className="text-white ml-2 font-semibold">{stats.avg}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-gray-700/50">
                  <span className="text-gray-500 text-xs">Total:</span>
                  <span className="text-white ml-2 font-semibold text-xs">{stats.total}</span>
                  <span className="text-gray-500 text-xs ml-1">activations</span>
                </div>
              </div>
            )}

            {/* No Data Message */}
            {heatmapData.length === 0 && (
              <div className="pt-2 border-t border-gray-700 text-xs text-gray-500 text-center">
                No activation data yet
              </div>
            )}
          </>
        )}

        {/* Help Text */}
        {!isHeatmapEnabled && (
          <div className="text-xs text-gray-500">
            Enable to visualize vector activation frequency during simulation
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatmapOverlay;
