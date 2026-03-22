"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Bot, User, Copy, Check, ChevronDown, ChevronUp, Zap, ArrowDown, Search, Brain, Globe, Cpu, CheckCircle, AlertCircle } from "lucide-react";
import { nexusWS, type WSMessage } from "@/lib/websocket";
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

interface TraceStep {
  step: string;
  status: "active" | "done" | "error";
  timestamp: number;
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
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
    nexusWS.connect();
    const unsubConnect = nexusWS.on("connected", () => setConnected(true));
    const unsubDisconnect = nexusWS.on("disconnected", () => setConnected(false));
    const unsubHello = nexusWS.on("hello-ok", () => setConnected(true));

    const unsubStream = nexusWS.on("chat-stream", (msg: WSMessage) => {
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

    const unsubDone = nexusWS.on("chat-done", (msg: WSMessage) => {
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

    const unsubError = nexusWS.on("chat-error", (msg: WSMessage) => {
      const payload = msg.payload as { error: string };
      setMessages(prev => [...prev, { id: String(Date.now()), role: "system", content: `Error: ${payload.error}`, timestamp: Date.now() }]);
      setIsStreaming(false);
    });

    const unsubToolCall = nexusWS.on("tool-call", (msg: WSMessage) => {
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

    const unsubProactive = nexusWS.on("proactive", (msg: WSMessage) => {
      const payload = msg.payload as { message: string };
      setMessages(prev => [...prev, { id: String(Date.now()), role: "assistant", content: payload.message, timestamp: Date.now() }]);
      scrollToBottom();
    });

    const unsubTrace = nexusWS.on("execution-trace", (msg: WSMessage) => {
      const payload = msg.payload as { step: string; status: string };
      const newStep: TraceStep = { step: payload.step, status: payload.status as TraceStep["status"], timestamp: Date.now() };
      setTraceSteps(prev => {
        const existing = prev.findIndex(s => s.step === payload.step);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newStep;
          return updated;
        }
        return [...prev, newStep];
      });
      scrollToBottom();
    });

    return () => { unsubConnect(); unsubDisconnect(); unsubHello(); unsubStream(); unsubDone(); unsubError(); unsubToolCall(); unsubProactive(); unsubTrace(); };
  }, [scrollToBottom]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setMessages(prev => [...prev, { id: String(Date.now()), role: "user", content: trimmed, timestamp: Date.now() }]);
    setIsStreaming(true);
    setTraceSteps([]);
    setTraceCollapsed(false);
    nexusWS.sendChat(trimmed);
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
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3);
        const firstNewline = lines.indexOf("\n");
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
        {/* Execution Trace - shown above messages when active */}
        {traceSteps.length > 0 && isStreaming && !traceCollapsed && (
          <div className="max-w-4xl mx-auto mb-3 animate-fade-in">
            <div className="bg-surface-2/80 backdrop-blur border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-medium text-indigo-300">Execution Trace</span>
                </div>
                <button onClick={() => setTraceCollapsed(true)} className="text-gray-600 hover:text-gray-400 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {traceSteps.map((step, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-xs transition-all duration-300",
                    step.status === "active" ? "text-indigo-300" : step.status === "done" ? "text-gray-500" : "text-red-400")}>
                    {step.status === "active" ? (
                      <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                        {step.step.toLowerCase().includes("search") || step.step.toLowerCase().includes("memor") ? (
                          <Brain className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        ) : step.step.toLowerCase().includes("web") || step.step.toLowerCase().includes("generat") ? (
                          <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        ) : step.step.toLowerCase().includes("analyz") ? (
                          <Search className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        ) : (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        )}
                      </div>
                    ) : step.status === "done" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    )}
                    <span className={step.status === "done" ? "line-through opacity-60" : ""}>{step.step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Collapsed trace indicator */}
        {traceSteps.length > 0 && isStreaming && traceCollapsed && (
          <div className="max-w-4xl mx-auto mb-3">
            <button onClick={() => setTraceCollapsed(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-400/80 bg-surface-2/50 border border-white/[0.04] rounded-lg hover:bg-surface-2 transition-colors">
              <Cpu className="w-3 h-3" />
              <span>{traceSteps.filter(s => s.status === "active").length} active step{traceSteps.filter(s => s.status === "active").length !== 1 ? "s" : ""}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/10">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1.5">Welcome to Nexus</h2>
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
              placeholder="Message Nexus... (/ for commands)" rows={1}
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
