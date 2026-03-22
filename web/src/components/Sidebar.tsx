'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Brain,
  Zap,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface-1 border-r border-gray-800/50 transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-nexus-600/20">
          <Hexagon className="w-5 h-5 text-nexus-400" />
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight text-white">
            NEXUS
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-nexus-600/20 text-nexus-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-3'
              )}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-nexus-400')} />
              {!collapsed && <span>{tab.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-gray-800/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-surface-3 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
