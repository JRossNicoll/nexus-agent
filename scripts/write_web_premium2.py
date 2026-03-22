#!/usr/bin/env python3
"""Write remaining premium web UI components for Sprint 2."""
import os

BASE = '/home/ubuntu/medo-agent'

def write_file(rel_path, content):
    full = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(content)
    print(f'  Written: {rel_path} ({len(content)} bytes)')

# ============================================================
# ChatView.tsx - premium with streaming, thinking, tool cards
# ============================================================
write_file('web/src/components/ChatView.tsx', '''"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Bot, User, Copy, Check, ChevronDown, ChevronUp, Zap, ArrowDown } from "lucide-react";
import { medoWS, type WSMessage } from "@/lib/websocket";
import { cn, formatTimestamp } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  latency_ms?: number;
  streaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

interface ToolCallInfo {
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  expanded?: boolean;
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!atBottom);
  }, []);

  useEffect(() => {
    medoWS.connect();
    const unsubConnect = medoWS.on("connected", () => setConnected(true));
    const unsubDisconnect = medoWS.on("disconnected", () => setConnected(false));
    const unsubHello = medoWS.on("hello-ok", () => setConnected(true));

    const unsubStream = medoWS.on("chat-stream", (msg: WSMessage) => {
      const payload = msg.payload as { content: string; done: boolean };
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + payload.content }];
        }
        return [...prev, { id: msg.id || String(Date.now()), role: "assistant", content: payload.content, timestamp: Date.now(), streaming: true }];
      });
      scrollToBottom();
    });

    const unsubDone = medoWS.on("chat-done", (msg: WSMessage) => {
      const payload = msg.payload as { model?: string; provider?: string; latency_ms?: number };
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { ...last, streaming: false, model: payload.model, provider: payload.provider, latency_ms: payload.latency_ms }];
        }
        return prev;
      });
      setIsStreaming(false);
      scrollToBottom();
    });

    const unsubError = medoWS.on("chat-error", (msg: WSMessage) => {
      const payload = msg.payload as { error: string };
      setMessages(prev => [...prev, { id: String(Date.now()), role: "system", content: `Error: ${payload.error}`, timestamp: Date.now() }]);
      setIsStreaming(false);
    });

    const unsubToolCall = medoWS.on("tool-call", (msg: WSMessage) => {
      const payload = msg.payload as { tool: string; input: Record<string, unknown> };
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          const toolCalls = [...(last.toolCalls || []), { tool: payload.tool, input: payload.input }];
          return [...prev.slice(0, -1), { ...last, toolCalls }];
        }
        return prev;
      });
    });

    const unsubProactive = medoWS.on("proactive", (msg: WSMessage) => {
      const payload = msg.payload as { message: string };
      setMessages(prev => [...prev, { id: String(Date.now()), role: "assistant", content: payload.message, timestamp: Date.now() }]);
      scrollToBottom();
    });

    return () => { unsubConnect(); unsubDisconnect(); unsubHello(); unsubStream(); unsubDone(); unsubError(); unsubToolCall(); unsubProactive(); };
  }, [scrollToBottom]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setMessages(prev => [...prev, { id: String(Date.now()), role: "user", content: trimmed, timestamp: Date.now() }]);
    setIsStreaming(true);
    medoWS.sendChat(trimmed);
    setInput("");
    inputRef.current?.focus();
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleToolCall = (msgIdx: number, toolIdx: number) => {
    setMessages(prev => prev.map((msg, i) => {
      if (i !== msgIdx || !msg.toolCalls) return msg;
      const toolCalls = msg.toolCalls.map((tc, j) => j === toolIdx ? { ...tc, expanded: !tc.expanded } : tc);
      return { ...msg, toolCalls };
    }));
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\\s\\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3);
        const firstNewline = lines.indexOf("\\n");
        const lang = firstNewline > 0 ? lines.slice(0, firstNewline).trim() : "";
        const code = firstNewline > 0 ? lines.slice(firstNewline + 1) : lines;
        return (
          <div key={i} className="my-3 relative group">
            {lang && (
              <div className="flex items-center justify-between px-4 py-1.5 bg-surface-3/50 rounded-t-lg border-b border-white/[0.04]">
                <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">{lang}</span>
                <button onClick={() => copyToClipboard(code, `code-${i}`)} className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors">
                  {copiedId === `code-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
            <pre className={cn("!mt-0", lang ? "!rounded-t-none" : "")}>
              <code>{code}</code>
            </pre>
            {!lang && (
              <button onClick={() => copyToClipboard(code, `code-${i}`)}
                className="absolute top-2 right-2 p-1.5 rounded bg-surface-3/80 opacity-0 group-hover:opacity-100 transition-opacity">
                {copiedId === `code-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            )}
          </div>
        );
      }
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((ip, j) => {
            if (ip.startsWith("`") && ip.endsWith("`")) {
              return <code key={j} className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[13px] text-indigo-300">{ip.slice(1, -1)}</code>;
            }
            return <span key={j}>{ip}</span>;
          })}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Chat</h1>
          <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]",
            connected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
            <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-emerald-400" : "bg-red-400")} />
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/10">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1.5">Welcome to Medo</h2>
            <p className="text-sm text-gray-500 max-w-md leading-relaxed">
              Your personal AI agent is ready. Start a conversation, use /commands for skills, or drag and drop files to share.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id} className={cn("flex gap-3 animate-fade-in max-w-4xl mx-auto", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role !== "user" && (
              <div className={cn("flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5",
                msg.role === "system" ? "bg-red-500/10" : "bg-indigo-500/15")}>
                <Bot className={cn("w-4 h-4", msg.role === "system" ? "text-red-400" : "text-indigo-400")} />
              </div>
            )}
            <div className={cn("max-w-2xl rounded-xl px-4 py-2.5",
              msg.role === "user" ? "bg-indigo-500/15 text-white border border-indigo-500/20"
                : msg.role === "system" ? "bg-red-500/10 text-red-300 border border-red-500/20"
                : "bg-surface-2 text-gray-200 border border-white/[0.04]")}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderContent(msg.content)}
                {msg.streaming && <span className="inline-block w-[2px] h-4 bg-indigo-400 typing-cursor ml-0.5 align-middle" />}
              </div>
              {/* Thinking dots */}
              {msg.streaming && !msg.content && (
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 thinking-dot" />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 thinking-dot" style={{"animationDelay": "0.2s"}} />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 thinking-dot" style={{"animationDelay": "0.4s"}} />
                </div>
              )}
              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {msg.toolCalls.map((tc, tIdx) => (
                    <div key={tIdx} className="border border-white/[0.06] rounded-lg overflow-hidden bg-surface-1/50">
                      <button onClick={() => toggleToolCall(idx, tIdx)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.03] transition-colors">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span className="font-mono text-amber-300/80">{tc.tool}</span>
                        {tc.expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                      </button>
                      {tc.expanded && (
                        <div className="px-3 py-2 bg-surface-1 text-xs font-mono text-gray-400 border-t border-white/[0.06]">
                          <div className="text-gray-600 mb-1 text-[10px] uppercase tracking-wider">Input</div>
                          <pre className="text-gray-300 whitespace-pre-wrap text-[11px]">{JSON.stringify(tc.input, null, 2)}</pre>
                          {tc.output && (<><div className="text-gray-600 mt-2 mb-1 text-[10px] uppercase tracking-wider">Output</div>
                            <pre className="text-gray-300 whitespace-pre-wrap text-[11px]">{tc.output}</pre></>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-600">
                <span>{formatTimestamp(msg.timestamp)}</span>
                {msg.model && <span className="font-mono text-gray-500">{msg.model}</span>}
                {msg.latency_ms && <span>{msg.latency_ms}ms</span>}
                {msg.role === "assistant" && !msg.streaming && (
                  <button onClick={() => copyToClipboard(msg.content, msg.id)} className="hover:text-gray-400 transition-colors">
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-surface-3 flex items-center justify-center mt-0.5">
                <User className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll indicator */}
      {showScrollBtn && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3/90 backdrop-blur border border-white/[0.1] rounded-full text-xs text-gray-300 hover:bg-surface-4 transition-colors shadow-lg">
            <ArrowDown className="w-3 h-3" /> New messages
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] glass">
        <div className="flex gap-2.5 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Message Medo... (/ for commands)" rows={1}
              className="w-full px-4 py-2.5 bg-surface-2 border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              style={{"minHeight": "42px", "maxHeight": "200px"}} />
          </div>
          <button onClick={sendMessage} disabled={!input.trim() || isStreaming}
            className={cn("flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
              input.trim() && !isStreaming
                ? "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25"
                : "bg-surface-3 text-gray-600 cursor-not-allowed")}>
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
''')

# ============================================================
# ActivityView.tsx - enhanced with premium styling
# ============================================================
write_file('web/src/components/ActivityView.tsx', '''"use client";

import { useState, useEffect } from "react";
import { Activity, Zap, MessageSquare, Brain, Clock, AlertTriangle, ChevronDown, ChevronUp, Filter, RefreshCw } from "lucide-react";
import { activityAPI, type ActivityEntry } from "@/lib/api";
import { cn, formatTimestamp } from "@/lib/utils";

const typeIcons: Record<string, typeof Zap> = {
  tool_call: Zap, proactive: Brain, cron: Clock, channel_message: MessageSquare,
  memory_write: Brain, skill_run: Zap, provider_failover: AlertTriangle,
};

const typeColors: Record<string, string> = {
  tool_call: "text-amber-400 bg-amber-400/10",
  proactive: "text-purple-400 bg-purple-400/10",
  cron: "text-blue-400 bg-blue-400/10",
  channel_message: "text-green-400 bg-green-400/10",
  memory_write: "text-cyan-400 bg-cyan-400/10",
  skill_run: "text-orange-400 bg-orange-400/10",
  provider_failover: "text-red-400 bg-red-400/10",
};

export default function ActivityView() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");

  useEffect(() => { loadActivities(); }, [filterType]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await activityAPI.getAll({ limit: 200, type: filterType || undefined });
      setActivities(data);
    } catch (err) { console.error("Failed to load activities:", err); }
    setLoading(false);
  };

  const activityTypes = ["", "tool_call", "proactive", "cron", "channel_message", "memory_write", "skill_run", "provider_failover"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <h1 className="text-sm font-semibold text-white">Activity</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-600" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-2.5 py-1 bg-surface-2 border border-white/[0.08] rounded-lg text-gray-400 text-xs focus:outline-none">
            <option value="">All types</option>
            {activityTypes.filter(Boolean).map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <button onClick={loadActivities} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-600">
            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mr-3" />
            Loading activities...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center text-gray-600 py-12">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No activity recorded yet</p>
            <p className="text-xs mt-1 text-gray-700">Activity will appear as the agent works</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activities.map(entry => {
              const Icon = typeIcons[entry.type] || Activity;
              const colorClass = typeColors[entry.type] || "text-gray-400 bg-gray-400/10";
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id} className="bg-surface-2 rounded-lg overflow-hidden animate-fade-in border border-white/[0.02] hover:border-white/[0.06] transition-all">
                  <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left">
                    <div className={cn("flex items-center justify-center w-6 h-6 rounded-md", colorClass)}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{entry.summary}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 flex-shrink-0">{formatTimestamp(entry.timestamp)}</span>
                    {entry.details && (isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    )}
                  </button>
                  {isExpanded && entry.details && (
                    <div className="px-4 pb-3 pt-0">
                      <pre className="text-[11px] text-gray-500 font-mono bg-surface-1 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto max-h-64 border border-white/[0.04]">
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
''')

# ============================================================
# SettingsView.tsx - with provider test, proactive settings, danger zone
# ============================================================
write_file('web/src/components/SettingsView.tsx', '''"use client";

import { useState, useEffect } from "react";
import {
  Settings, Key, Server, MessageSquare, Brain, Shield, Save, RefreshCw,
  CheckCircle, XCircle, Zap, AlertTriangle, Trash2, Play,
} from "lucide-react";
import { configAPI, healthAPI, providerAPI, proactiveAPI, type MedoConfig, type HealthResponse, type ProactiveStatus } from "@/lib/api";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

type SettingsTab = "providers" | "channels" | "proactive" | "memory" | "gateway" | "danger";

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [config, setConfig] = useState<MedoConfig | null>(null);
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
              <p className="text-xs text-gray-500">Medo can proactively surface insights based on your conversations and memory.</p>

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
''')

print('\\nAll premium web components written!')
