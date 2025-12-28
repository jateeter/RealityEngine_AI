import React, { useRef, useEffect, useState } from 'react';
import { useVisualizerStore } from '../store';
import { ActivityEvent } from '../types';

const ActivityFeed: React.FC = () => {
  const {
    activityEvents,
    clearActivityEvents
  } = useVisualizerStore();

  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0; // Scroll to top since events are prepended
    }
  }, [activityEvents, autoScroll]);

  const filteredEvents = activityEvents.filter(event => {
    if (filter === 'all') return true;
    return event.severity === filter;
  });

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✕';
      default: return '•';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'success': return 'text-green-400 bg-green-900/20 border-green-700';
      case 'warning': return 'text-yellow-400 bg-yellow-900/20 border-yellow-700';
      case 'error': return 'text-red-400 bg-red-900/20 border-red-700';
      default: return 'text-blue-400 bg-blue-900/20 border-blue-700';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'vector-processed': return 'Vector';
      case 'sequence-matched': return 'Match';
      case 'output-asserted': return 'Output';
      case 'transition': return 'Transition';
      case 'error': return 'Error';
      default: return 'Info';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getFilterCount = (severity: 'all' | 'info' | 'success' | 'warning' | 'error'): number => {
    if (severity === 'all') return activityEvents.length;
    return activityEvents.filter(e => e.severity === severity).length;
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-850">
        <h3 className="text-sm font-semibold text-white">Activity Feed</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              autoScroll
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScroll ? '📌 Auto' : '📌 Manual'}
          </button>
          <button
            onClick={clearActivityEvents}
            disabled={activityEvents.length === 0}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Clear all events"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 bg-gray-850">
        <button
          onClick={() => setFilter('all')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'all'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All ({getFilterCount('all')})
        </button>
        <button
          onClick={() => setFilter('info')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Info ({getFilterCount('info')})
        </button>
        <button
          onClick={() => setFilter('success')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Success ({getFilterCount('success')})
        </button>
        <button
          onClick={() => setFilter('warning')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'warning'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Warnings ({getFilterCount('warning')})
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Errors ({getFilterCount('error')})
        </button>
      </div>

      {/* Event List */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {filter === 'all' ? 'No activity yet' : `No ${filter} events`}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`
                border rounded-lg p-3 transition-all
                ${getSeverityColor(event.severity)}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-lg leading-none">
                    {getSeverityIcon(event.severity)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide opacity-75">
                        {getTypeLabel(event.type)}
                      </span>
                      <span className="text-xs opacity-60">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm break-words">
                      {event.message}
                    </div>
                    {event.metadata && (
                      <details className="mt-2 text-xs opacity-75">
                        <summary className="cursor-pointer hover:opacity-100">
                          Details
                        </summary>
                        <pre className="mt-1 p-2 bg-black/20 rounded overflow-x-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-gray-700 bg-gray-850 text-xs text-gray-400">
        {activityEvents.length > 0 ? (
          <span>
            Showing {filteredEvents.length} of {activityEvents.length} events
            {activityEvents.length >= 100 && ' (max 100)'}
          </span>
        ) : (
          <span>No events</span>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
