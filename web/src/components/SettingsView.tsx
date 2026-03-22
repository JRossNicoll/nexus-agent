'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Server,
  MessageSquare,
  Brain,
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { configAPI, healthAPI, type NexusConfig, type HealthResponse } from '@/lib/api';
import { cn, formatBytes, formatDuration } from '@/lib/utils';

type SettingsTab = 'providers' | 'channels' | 'proactive' | 'memory' | 'gateway';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, hlth] = await Promise.all([
        configAPI.get(),
        healthAPI.get().catch(() => null),
      ]);
      setConfig(cfg);
      setHealth(hlth);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      await configAPI.update(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
    { id: 'providers', label: 'Providers', icon: Server },
    { id: 'channels', label: 'Channels', icon: MessageSquare },
    { id: 'proactive', label: 'Proactive', icon: Brain },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'gateway', label: 'Gateway', icon: Shield },
  ];

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-gray-800/50 bg-surface-1/50">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-sm hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              saved ? 'bg-green-600/20 text-green-400' : 'bg-nexus-600 text-white hover:bg-nexus-500'
            )}
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <div className="w-48 border-r border-gray-800/50 py-4 px-2 flex-shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors mb-1',
                  activeTab === tab.id
                    ? 'bg-nexus-600/20 text-nexus-400'
                    : 'text-gray-400 hover:text-white hover:bg-surface-3'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'providers' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-base font-semibold text-white mb-4">LLM Providers</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Primary Model</label>
                    <input
                      type="text"
                      value={config.provider.primary}
                      onChange={(e) => setConfig({ ...config, provider: { ...config.provider, primary: e.target.value } })}
                      className="w-full px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Fallback Model</label>
                    <input
                      type="text"
                      value={config.provider.fallback}
                      onChange={(e) => setConfig({ ...config, provider: { ...config.provider, fallback: e.target.value } })}
                      className="w-full px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3">API Keys</h3>
                <div className="space-y-3">
                  {Object.entries(config.provider.apiKeys).map(([provider, key]) => (
                    <div key={provider}>
                      <label className="block text-sm text-gray-400 mb-1 capitalize">{provider}</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="password"
                            value={key}
                            onChange={(e) => setConfig({
                              ...config,
                              provider: {
                                ...config.provider,
                                apiKeys: { ...config.provider.apiKeys, [provider]: e.target.value },
                              },
                            })}
                            className="w-full pl-10 pr-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'channels' && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-base font-semibold text-white mb-4">Channels</h2>

              {/* Web */}
              <div className="bg-surface-2 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Web UI</h3>
                      <p className="text-xs text-gray-500">Always on — primary interface</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full">Active</span>
                </div>
              </div>

              {/* Telegram */}
              <div className="bg-surface-2 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Telegram</h3>
                      <p className="text-xs text-gray-500">Bot integration via Grammy.js</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full',
                    health?.channels?.telegram
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-500'
                  )}>
                    {health?.channels?.telegram ? 'Connected' : 'Not configured'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
                  <input
                    type="password"
                    placeholder="Enter Telegram bot token..."
                    className="w-full px-3 py-2 bg-surface-3 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="bg-surface-2 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">WhatsApp</h3>
                      <p className="text-xs text-gray-500">WhatsApp Web via Baileys — QR pairing</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-500/10 text-gray-500 rounded-full">
                    Not configured
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'proactive' && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-base font-semibold text-white mb-4">Proactive Intelligence</h2>
              <p className="text-sm text-gray-400">
                Nexus can proactively surface insights and reminders based on your conversations
                and memory without being asked.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-surface-2 rounded-xl p-4">
                  <div>
                    <h3 className="font-medium text-white">Enable Proactive Messages</h3>
                    <p className="text-xs text-gray-500 mt-1">Allow Nexus to send unsolicited insights</p>
                  </div>
                  <button className="text-nexus-400">
                    <CheckCircle className="w-6 h-6" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Check Interval (hours)</label>
                  <input
                    type="number"
                    defaultValue={4}
                    min={1}
                    max={24}
                    className="w-32 px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Confidence Threshold</label>
                  <input
                    type="number"
                    defaultValue={0.75}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-32 px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Max Messages Per Day</label>
                  <input
                    type="number"
                    defaultValue={3}
                    min={0}
                    max={10}
                    className="w-32 px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-base font-semibold text-white mb-4">Memory Configuration</h2>

              {health && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-2 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Semantic Memories</p>
                    <p className="text-2xl font-semibold text-white mt-1">{health.memory.totalMemories}</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Conversations</p>
                    <p className="text-2xl font-semibold text-white mt-1">{health.memory.totalConversations}</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Structured Facts</p>
                    <p className="text-2xl font-semibold text-white mt-1">{health.memory.totalStructured}</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Database Size</p>
                    <p className="text-2xl font-semibold text-white mt-1">{formatBytes(health.memory.dbSizeBytes)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Embedding Model</label>
                <input
                  type="text"
                  value={config.memory.embeddingModel}
                  onChange={(e) => setConfig({ ...config, memory: { ...config.memory, embeddingModel: e.target.value } })}
                  className="w-full px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Vector Store</label>
                <input
                  type="text"
                  value={config.memory.vectorStore}
                  readOnly
                  className="w-full px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-gray-500 text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'gateway' && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-base font-semibold text-white mb-4">Gateway</h2>

              {health && (
                <div className="bg-surface-2 rounded-xl p-4 border border-gray-700/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={cn('ml-2', health.status === 'ok' ? 'text-green-400' : 'text-amber-400')}>
                        {health.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Uptime:</span>
                      <span className="ml-2 text-white">{formatDuration(health.uptime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Version:</span>
                      <span className="ml-2 text-white">{health.version}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Cron Jobs:</span>
                      <span className="ml-2 text-white">{health.activeCronJobs}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Gateway Port</label>
                <input
                  type="number"
                  value={config.gateway.port}
                  onChange={(e) => setConfig({
                    ...config,
                    gateway: { ...config.gateway, port: parseInt(e.target.value, 10) },
                  })}
                  className="w-32 px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Auth Token</label>
                <input
                  type="password"
                  value={config.gateway.auth.token}
                  onChange={(e) => setConfig({
                    ...config,
                    gateway: { ...config.gateway, auth: { token: e.target.value } },
                  })}
                  className="w-full px-3 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
