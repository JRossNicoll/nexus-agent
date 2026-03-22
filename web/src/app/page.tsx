'use client';

import { useState, useEffect } from 'react';
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

  const handleSendFromHome = (msg: string) => {
    setActiveTab('chat');
    // Small delay so ChatView mounts before we send
    setTimeout(() => {
      nexusWS.sendChat(msg);
    }, 200);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen onSend={handleSendFromHome} onNavigate={setActiveTab} />;
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
        return <HomeScreen onSend={handleSendFromHome} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </main>
      <AmbientOrb />
      <CommandPalette onNavigate={setActiveTab} />
    </div>
  );
}
