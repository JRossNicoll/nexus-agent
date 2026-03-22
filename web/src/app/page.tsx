'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import LandingPage from '@/components/LandingPage';
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
import { medoWS } from '@/lib/websocket';

export default function Home() {
  const [showApp, setShowApp] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['home']));
  const [pendingChat, setPendingChat] = useState<string | null>(null);

  // Hash-based routing: #app shows the app, otherwise landing page
  useEffect(() => {
    const checkHash = () => {
      setShowApp(window.location.hash === '#app');
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Persistent app-level WebSocket connection (only when in app mode)
  useEffect(() => {
    if (showApp) {
      medoWS.connect();
    }
  }, [showApp]);

  useEffect(() => {
    if (!showApp) return;
    authAPI.verify('')
      .then((res) => {
        if (res.noAuthRequired || res.authenticated) {
          setAuthenticated(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, [showApp]);

  useEffect(() => {
    if (!authenticated || !showApp) return;
    setCheckingOnboarding(true);
    onboardingAPI.getStatus()
      .then((status) => {
        if (!status.completed) {
          setNeedsOnboarding(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingOnboarding(false));
  }, [authenticated, showApp]);

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

  const handleBackToLanding = useCallback(() => {
    window.location.hash = '';
    setShowApp(false);
  }, []);

  const allTabs = useMemo(() => ['home', 'chat', 'memory', 'skills', 'activity', 'settings'], []);

  // ─── Landing page ───
  if (!showApp) {
    return <LandingPage />;
  }

  // ─── App loading ───
  if (checkingAuth || checkingOnboarding) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2px solid rgba(255,51,51,0.2)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span>Connecting to MEDO...</span>
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
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogoClick={handleBackToLanding} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
              {tab === 'activity' && <ActivityView onNavigate={(target, ctx) => { setActiveTab(target); }} />}
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
