'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatView from '@/components/ChatView';
import MemoryView from '@/components/MemoryView';
import SkillsView from '@/components/SkillsView';
import ActivityView from '@/components/ActivityView';
import SettingsView from '@/components/SettingsView';
import AuthGate from '@/components/AuthGate';
import { authAPI } from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState('chat');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if auth is required
    authAPI.verify('')
      .then((res) => {
        if (res.noAuthRequired || res.authenticated) {
          setAuthenticated(true);
        }
      })
      .catch(() => {
        // Gateway not reachable or auth required
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Connecting to NEXUS...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;
  }

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
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
