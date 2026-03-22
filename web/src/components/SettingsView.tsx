"use client";

import { useState, useEffect } from "react";
import {
  Settings, Key, Server, MessageSquare, Brain, Shield, Save, RefreshCw,
  CheckCircle, XCircle, Zap, AlertTriangle, Trash2, Play,
} from "lucide-react";
import { configAPI, healthAPI, providerAPI, proactiveAPI, type NexusConfig, type HealthResponse, type ProactiveStatus } from "@/lib/api";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

type SettingsTab = "providers" | "channels" | "proactive" | "memory" | "gateway" | "danger";

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [proStatus, setProStatus] = useState<ProactiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, hlth] = await Promise.all([
        configAPI.get(),
        healthAPI.get().catch(() => null),
      ]);
      setConfig(cfg);
      setHealth(hlth);
      try { const ps = await proactiveAPI.getStatus(); setProStatus(ps); } catch {}
    } catch (err) { console.error("Failed to load settings:", err); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;
    try { await configAPI.update(config); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (err) { console.error("Save failed:", err); }
  };

  const handleTestProvider = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await providerAPI.test();
      setTestResult({ success: result.success, message: result.success ? `Connected to ${result.provider || "provider"}` : (result.error || "Test failed") });
    } catch (err) {
      setTestResult({ success: false, message: "Connection failed" });
    }
    setTesting(false);
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
    { id: "providers", label: "Providers", icon: Server },
    { id: "channels", label: "Channels", icon: MessageSquare },
    { id: "proactive", label: "Proactive", icon: Brain },
    { id: "memory", label: "Memory", icon: Brain },
    { id: "gateway", label: "Gateway", icon: Shield },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ];

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mr-3" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <h1 className="text-sm font-semibold text-white">Settings</h1>
        <div className="flex items-center gap-2">
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-xs hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={handleSave}
            className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
              saved ? "bg-green-500/15 text-green-400" : "bg-indigo-500 text-white hover:bg-indigo-400")}>
            {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <div className="w-44 border-r border-white/[0.06] py-3 px-1.5 flex-shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs transition-all mb-0.5",
                  activeTab === tab.id ? "bg-indigo-500/15 text-indigo-300" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]",
                  tab.id === "danger" && "text-red-400/60 hover:text-red-400")}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "providers" && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <div>
                <h2 className="text-sm font-semibold text-white mb-4">LLM Providers</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Primary Model</label>
                    <input type="text" value={config.provider.primary}
                      onChange={e => setConfig({ ...config, provider: { ...config.provider, primary: e.target.value } })}
                      className="w-full px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Fallback Model</label>
                    <input type="text" value={config.provider.fallback}
                      onChange={e => setConfig({ ...config, provider: { ...config.provider, fallback: e.target.value } })}
                      className="w-full px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-white">API Keys</h3>
                  <button onClick={handleTestProvider} disabled={testing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-3 text-gray-300 rounded-lg text-xs hover:bg-surface-4 transition-colors disabled:opacity-50">
                    {testing ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Play className="w-3 h-3" />}
                    Test Connection
                  </button>
                </div>
                {testResult && (
                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs",
                    testResult.success ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                    {testResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {testResult.message}
                  </div>
                )}
                <div className="space-y-3">
                  {Object.entries(config.provider.apiKeys).map(([provider, key]) => (
                    <div key={provider}>
                      <label className="block text-xs text-gray-500 mb-1 capitalize">{provider}</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                        <input type="password" value={key}
                          onChange={e => setConfig({ ...config, provider: { ...config.provider, apiKeys: { ...config.provider.apiKeys, [provider]: e.target.value } } })}
                          className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "channels" && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <h2 className="text-sm font-semibold text-white mb-4">Channels</h2>
              {/* Web */}
              <div className="bg-surface-2 rounded-xl p-4 border border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">Web UI</h3>
                      <p className="text-[10px] text-gray-600">Always on</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">Active</span>
                </div>
              </div>
              {/* Telegram */}
              <div className="bg-surface-2 rounded-xl p-4 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">Telegram</h3>
                      <p className="text-[10px] text-gray-600">Bot via Grammy.js</p>
                    </div>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full",
                    health?.channels?.telegram ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-600")}>
                    {health?.channels?.telegram ? "Connected" : "Not configured"}
                  </span>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bot Token</label>
                  <input type="password" placeholder="Enter Telegram bot token..."
                    className="w-full px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                </div>
              </div>
              {/* WhatsApp */}
              <div className="bg-surface-2 rounded-xl p-4 border border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">WhatsApp</h3>
                      <p className="text-[10px] text-gray-600">WhatsApp Web via Baileys</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-500/10 text-gray-600 rounded-full">Not configured</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "proactive" && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <h2 className="text-sm font-semibold text-white mb-4">Proactive Intelligence</h2>
              <p className="text-xs text-gray-500">Nexus can proactively surface insights based on your conversations and memory.</p>

              {proStatus && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-2 rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] text-gray-600">Pattern Detection</p>
                    <p className={cn("text-sm font-semibold mt-1", proStatus.patternDetection ? "text-emerald-400" : "text-gray-600")}>
                      {proStatus.patternDetection ? "Active" : "Off"}
                    </p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] text-gray-600">Daily Briefing</p>
                    <p className={cn("text-sm font-semibold mt-1", proStatus.dailyBriefing ? "text-emerald-400" : "text-gray-600")}>
                      {proStatus.dailyBriefing ? "Active" : "Off"}
                    </p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] text-gray-600">Today</p>
                    <p className="text-sm font-semibold text-white mt-1">{proStatus.todayMessageCount} msgs</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Check Interval (hours)</label>
                  <input type="number" defaultValue={config.proactive?.intervalHours || 6} min={1} max={24}
                    className="w-28 px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Confidence Threshold</label>
                  <input type="number" defaultValue={config.proactive?.confidenceThreshold || 0.75} min={0} max={1} step={0.05}
                    className="w-28 px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Max Messages Per Day</label>
                  <input type="number" defaultValue={config.proactive?.maxPerDay || 3} min={0} max={10}
                    className="w-28 px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Briefing Time</label>
                  <input type="time" defaultValue={config.proactive?.briefingTime || "07:00"}
                    className="w-36 px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "memory" && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <h2 className="text-sm font-semibold text-white mb-4">Memory Configuration</h2>
              {health && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Semantic Memories", value: health.memory.totalMemories },
                    { label: "Conversations", value: health.memory.totalConversations },
                    { label: "Structured Facts", value: health.memory.totalStructured },
                    { label: "Database Size", value: formatBytes(health.memory.dbSizeBytes) },
                  ].map(item => (
                    <div key={item.label} className="bg-surface-2 rounded-xl p-3 border border-white/[0.04]">
                      <p className="text-[10px] text-gray-600">{item.label}</p>
                      <p className="text-xl font-semibold text-white mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Embedding Model</label>
                <input type="text" value={config.memory.embeddingModel}
                  onChange={e => setConfig({ ...config, memory: { ...config.memory, embeddingModel: e.target.value } })}
                  className="w-full px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Vector Store</label>
                <input type="text" value={config.memory.vectorStore} readOnly
                  className="w-full px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-gray-600 text-sm cursor-not-allowed" />
              </div>
            </div>
          )}

          {activeTab === "gateway" && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <h2 className="text-sm font-semibold text-white mb-4">Gateway</h2>
              {health && (
                <div className="bg-surface-2 rounded-xl p-4 border border-white/[0.04]">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-600 text-xs">Status</span>
                      <p className={cn("font-medium", health.status === "ok" ? "text-emerald-400" : "text-amber-400")}>{health.status}</p></div>
                    <div><span className="text-gray-600 text-xs">Uptime</span><p className="text-white font-medium">{formatDuration(health.uptime)}</p></div>
                    <div><span className="text-gray-600 text-xs">Version</span><p className="text-white font-medium">{health.version}</p></div>
                    <div><span className="text-gray-600 text-xs">Cron Jobs</span><p className="text-white font-medium">{health.activeCronJobs}</p></div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Gateway Port</label>
                <input type="number" value={config.gateway.port}
                  onChange={e => setConfig({ ...config, gateway: { ...config.gateway, port: parseInt(e.target.value, 10) } })}
                  className="w-28 px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Auth Token</label>
                <input type="password" value={config.gateway.auth.token}
                  onChange={e => setConfig({ ...config, gateway: { ...config.gateway, auth: { token: e.target.value } } })}
                  className="w-full px-3 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
              </div>
            </div>
          )}

          {activeTab === "danger" && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <h2 className="text-sm font-semibold text-red-400 mb-4">Danger Zone</h2>
              <p className="text-xs text-gray-500">These actions are destructive and cannot be undone.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-surface-2 rounded-xl p-4 border border-red-500/10">
                  <div>
                    <h3 className="text-sm font-medium text-white">Clear All Memories</h3>
                    <p className="text-[10px] text-gray-600 mt-0.5">Delete all semantic and structured memories</p>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-colors">
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
                <div className="flex items-center justify-between bg-surface-2 rounded-xl p-4 border border-red-500/10">
                  <div>
                    <h3 className="text-sm font-medium text-white">Clear Conversation History</h3>
                    <p className="text-[10px] text-gray-600 mt-0.5">Delete all stored conversations</p>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-colors">
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
                <div className="flex items-center justify-between bg-surface-2 rounded-xl p-4 border border-red-500/10">
                  <div>
                    <h3 className="text-sm font-medium text-white">Reset Agent</h3>
                    <p className="text-[10px] text-gray-600 mt-0.5">Clear all data and reset to factory defaults</p>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-colors">
                    <AlertTriangle className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
