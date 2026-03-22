'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  MessageSquare,
  Brain,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { activityAPI, type ActivityEntry } from '@/lib/api';
import { cn, formatTimestamp } from '@/lib/utils';

const typeIcons: Record<string, typeof Zap> = {
  tool_call: Zap,
  proactive: Brain,
  cron: Clock,
  channel_message: MessageSquare,
  memory_write: Brain,
  skill_run: Zap,
  provider_failover: AlertTriangle,
};

const typeColors: Record<string, string> = {
  tool_call: 'text-amber-400 bg-amber-400/10',
  proactive: 'text-purple-400 bg-purple-400/10',
  cron: 'text-blue-400 bg-blue-400/10',
  channel_message: 'text-green-400 bg-green-400/10',
  memory_write: 'text-cyan-400 bg-cyan-400/10',
  skill_run: 'text-orange-400 bg-orange-400/10',
  provider_failover: 'text-red-400 bg-red-400/10',
};

export default function ActivityView() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    loadActivities();
  }, [filterType]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await activityAPI.getAll({
        limit: 200,
        type: filterType || undefined,
      });
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
    setLoading(false);
  };

  const activityTypes = [
    '',
    'tool_call',
    'proactive',
    'cron',
    'channel_message',
    'memory_write',
    'skill_run',
    'provider_failover',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-gray-800/50 bg-surface-1/50">
        <h1 className="text-lg font-semibold text-white">Activity</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border border-gray-700/50 rounded-lg text-gray-300 text-sm focus:outline-none"
          >
            <option value="">All types</option>
            {activityTypes.filter(Boolean).map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading activities...</div>
        ) : activities.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No activity recorded yet</p>
            <p className="text-sm mt-1">Activity will appear as the agent works</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map(entry => {
              const Icon = typeIcons[entry.type] || Activity;
              const colorClass = typeColors[entry.type] || 'text-gray-400 bg-gray-400/10';
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="bg-surface-2 rounded-lg overflow-hidden animate-fade-in hover:bg-surface-3 transition-colors"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left"
                  >
                    <div className={cn('flex items-center justify-center w-7 h-7 rounded-md', colorClass)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{entry.summary}</p>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    {entry.details && (
                      isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && entry.details && (
                    <div className="px-4 pb-3 pt-0">
                      <pre className="text-xs text-gray-400 font-mono bg-surface-1 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto max-h-64">
                        {entry.details}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
