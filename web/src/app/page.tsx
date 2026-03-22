'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatView from '@/components/ChatView';
import MemoryView from '@/components/MemoryView';
import SkillsView from '@/components/SkillsView';
import ActivityView from '@/components/ActivityView';
import SettingsView from '@/components/SettingsView';
import HomeScreen from '@/components/HomeScreen';
import AuthGate from '@/components/AuthGate';
import OnboardingFlow from '@/components/OnboardingFlow';
import AmbientOrb from '@/components/AmbientOrb';
import CommandPalette from '@/components/CommandPalette';
import { authAPI, onboardingAPI } from '@/lib/api';
import { nexusWS } from '@/lib/websocket';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  // Track which tabs have been visited so we keep them mounted (cache)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['home']));
  const [pendingChat, setPendingChat] = useState<string | null>(null);

  // Persistent app-level WebSocket connection
  useEffect(() => {
    nexusWS.connect();
    return () => { /* don't disconnect on unmount — persistent */ };
  }, []);

  useEffect(() => {
    authAPI.verify('')
      .then((res) => {
        if (res.noAuthRequired || res.authenticated) {
          setAuthenticated(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    setCheckingOnboarding(true);
    onboardingAPI.getStatus()
      .then((status) => {
        if (!status.completed) {
          setNeedsOnboarding(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingOnboarding(false));
  }, [authenticated]);

  // When activeTab changes, add it to visited set
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  const handleSendFromHome = useCallback((msg: string) => {
    setActiveTab('chat');
    setPendingChat(msg);
  }, []);

  // All possible tabs
  const allTabs = useMemo(() => ['home', 'chat', 'memory', 'skills', 'activity', 'settings'], []);

  if (checkingAuth || checkingOnboarding) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2px solid rgba(45,140,255,0.2)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span>Connecting to NEXUS...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Render visited tabs with display:none to keep them cached */}
        {allTabs.map(tab => {
          const isActive = tab === activeTab;
          const wasVisited = visitedTabs.has(tab);
          if (!wasVisited) return null;
          return (
            <div key={tab} style={{ display: isActive ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' }}>
              {tab === 'home' && <HomeScreen onSend={handleSendFromHome} onNavigate={setActiveTab} />}
              {tab === 'chat' && <ChatView pendingMessage={pendingChat} onPendingConsumed={() => setPendingChat(null)} />}
              {tab === 'memory' && <MemoryView />}
              {tab === 'skills' && <SkillsView />}
              {tab === 'activity' && <ActivityView />}
              {tab === 'settings' && <SettingsView />}
            </div>
          );
        })}
      </main>
      <AmbientOrb />
      <CommandPalette onNavigate={setActiveTab} />
    </div>
  );
}
