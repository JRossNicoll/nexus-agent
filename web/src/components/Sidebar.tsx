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
        'flex flex-col glass border-r border-white/[0.06] transition-all duration-300 ease-out',
        collapsed ? 'w-[52px]' : 'w-52'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 h-14 border-b border-white/[0.06]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20 flex-shrink-0">
          <Hexagon className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-white gradient-text">
            NEXUS
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1.5 py-3 space-y-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-500/10'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              )}
              title={collapsed ? tab.label : undefined}
            >
              <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive && 'text-indigo-400')} />
              {!collapsed && <span>{tab.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-1.5 py-2 border-t border-white/[0.06]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.04] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
