'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatView from '@/components/ChatView';
import MemoryView from '@/components/MemoryView';
import SkillsView from '@/components/SkillsView';
import ActivityView from '@/components/ActivityView';
import SettingsView from '@/components/SettingsView';

export default function Home() {
  const [activeTab, setActiveTab] = useState('chat');

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatView />;
      case 'memory':
        return <MemoryView />;
      case 'skills':
        return <SkillsView />;
      case 'activity':
        return <ActivityView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
