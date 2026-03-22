"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Send, Loader2, Bot, User, Copy, Check, ChevronDown, ChevronUp, Zap, ArrowDown, Search, Brain, Globe, Cpu, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { nexusWS, type WSMessage } from "@/lib/websocket";
import { cn, formatTimestamp } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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
  isProactive?: boolean;
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

interface ChatViewProps {
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
}

/* ── Markdown rendering components ── */
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded transition-opacity opacity-0 group-hover:opacity-100"
      style={{ background: "var(--bg-raised)" }}>
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
    </button>
  );
}

function buildMarkdownComponents(): Components {
  return {
    p({ children }) {
      return <p style={{ fontSize: "13.5px", lineHeight: 1.7, color: "#b8bec9", marginBottom: 10 }}>{children}</p>;
    },
    strong({ children }) {
      return <strong style={{ color: "#c8cdd6", fontWeight: 500 }}>{children}</strong>;
    },
    ul({ children }) {
      return <ul style={{ paddingLeft: 18, marginBottom: 10, color: "#b8bec9" }}>{children}</ul>;
    },
    ol({ children }) {
      return <ol style={{ paddingLeft: 18, marginBottom: 10, color: "#b8bec9" }}>{children}</ol>;
    },
    li({ children }) {
      return <li style={{ marginBottom: 4, lineHeight: 1.6 }}>{children}</li>;
    },
    h1({ children }) {
      return <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, color: "#c8cdd6", marginBottom: 8, marginTop: 14, fontSize: 16 }}>{children}</h1>;
    },
    h2({ children }) {
      return <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, color: "#c8cdd6", marginBottom: 8, marginTop: 14, fontSize: 14 }}>{children}</h2>;
    },
    h3({ children }) {
      return <h3 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, color: "#c8cdd6", marginBottom: 8, marginTop: 14, fontSize: 13 }}>{children}</h3>;
    },
    a({ href, children }) {
      return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#2d8cff", textDecoration: "none" }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>{children}</a>;
    },
    blockquote({ children }) {
      return <blockquote style={{ borderLeft: "2px solid rgba(45,140,255,0.3)", paddingLeft: 12, color: "#7e8899", margin: "8px 0" }}>{children}</blockquote>;
    },
    hr() {
      return <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "12px 0" }} />;
    },
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const isBlock = match || (typeof children === "string" && children.includes("\n"));
      if (isBlock) {
        const codeStr = String(children).replace(/\n$/, "");
        return (
          <div className="relative group" style={{ marginBottom: 10 }}>
            {match && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px",
                background: "var(--bg-raised)", borderBottom: "1px solid rgba(255,255,255,0.04)",
                borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#7e8899", textTransform: "uppercase", letterSpacing: "0.5px" }}>{match[1]}</span>
              </div>
            )}
            <pre style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: match ? "0 0 8px 8px" : 8, padding: "12px 14px",
              fontFamily: "JetBrains Mono, monospace", fontSize: 12, overflowX: "auto", margin: 0 }}>
              <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{codeStr}</code>
            </pre>
            <CodeCopyButton code={codeStr} />
          </div>
        );
      }
      // Inline code
      return (
        <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12,
          background: "rgba(45,140,255,0.08)", border: "1px solid rgba(45,140,255,0.15)",
          borderRadius: 4, padding: "1px 6px", color: "rgba(45,140,255,0.85)" }} {...props}>{children}</code>
      );
    },
    pre({ children }) {
      // The code component handles the actual rendering — just pass children through
      return <>{children}</>;
    },
  };
}

const mdComponents = buildMarkdownComponents();

export default function ChatView({ pendingMessage, onPendingConsumed }: ChatViewProps) {
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

  // Debounced streaming content: buffer raw stream and flush every 50ms
  const [debouncedMessages, setDebouncedMessages] = useState<Message[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const hasStreaming = messages.some(m => m.streaming);
    if (hasStreaming) {
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedMessages([...messages]);
      }, 50);
    } else {
      // Not streaming — update immediately
      setDebouncedMessages([...messages]);
    }
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [messages]);

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
    // WebSocket connection is managed at app level (page.tsx) — no connect() call here
    const unsubConnect = nexusWS.on("connected", () => setConnected(true));
    const unsubDisconnect = nexusWS.on("disconnected", () => setConnected(false));
    const unsubHello = nexusWS.on("hello-ok", () => setConnected(true));
    // Sync initial state
    setConnected(nexusWS.isConnected());

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
      setMessages(prev => [...prev, { id: String(Date.now()), role: "system", content: `Something went wrong. Please try again.`, timestamp: Date.now() }]);
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
      setMessages(prev => [...prev, {
        id: "proactive-" + Date.now(),
        role: "assistant",
        content: payload.message,
        timestamp: Date.now(),
        isProactive: true,
      } as Message & { isProactive?: boolean }]);
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


  // First message flag — inject onboarding context into first response
  const [isFirstMessage, setIsFirstMessage] = useState(false);
  useEffect(() => {
    fetch((process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799") + "/api/v1/first-message-flag")
      .then(r => r.json())
      .then(d => { if (d.firstMessage) setIsFirstMessage(true); })
      .catch(() => {});
  }, []);

  // Handle pending message from HomeScreen
  useEffect(() => {
    if (pendingMessage && connected && !isStreaming) {
      setMessages(prev => [...prev, { id: String(Date.now()), role: "user", content: pendingMessage, timestamp: Date.now() }]);
      setIsStreaming(true);
      setTraceSteps([]);
      setTraceCollapsed(false);
      nexusWS.sendChat(pendingMessage);
      onPendingConsumed?.();
      scrollToBottom();
    }
  }, [pendingMessage, connected, isStreaming, onPendingConsumed, scrollToBottom]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setMessages(prev => [...prev, { id: String(Date.now()), role: "user", content: trimmed, timestamp: Date.now() }]);
    setIsStreaming(true);
    setTraceSteps([]);
    setTraceCollapsed(false);
    // If this is the first message, notify gateway to include onboarding context
    if (isFirstMessage) {
      nexusWS.send({ type: 'chat', payload: { message: trimmed, channel: 'web', first_message: true } });
      setIsFirstMessage(false);
    } else {
      nexusWS.sendChat(trimmed);
    }
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

  /* ── Render message content with ReactMarkdown ── */
  const renderContent = (msg: Message) => {
    return (
      <div className="nexus-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {msg.content}
        </ReactMarkdown>
        {msg.streaming && <span className="inline-block w-[2px] h-4 bg-[var(--accent)] typing-cursor ml-0.5 align-middle" />}
      </div>
    );
  };

  // Use debouncedMessages for rendering to avoid flicker during streaming
  const displayMessages = debouncedMessages;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", backdropFilter: "blur(12px)" }} className="flex items-center justify-between px-6 h-12">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Chat</h1>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Execution Trace - shown above messages when active */}
        {traceSteps.length > 0 && isStreaming && !traceCollapsed && (
          <div className="max-w-4xl mx-auto mb-3 animate-fade-in">
            <div className="bg-[var(--bg-surface)] backdrop-blur border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="font-medium text-[var(--accent)]">Execution Trace</span>
                </div>
                <button onClick={() => setTraceCollapsed(true)} className="text-gray-600 hover:text-gray-400 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {traceSteps.map((step, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-xs transition-all duration-300",
                    step.status === "active" ? "text-[var(--accent)]" : step.status === "done" ? "text-gray-500" : "text-red-400")}>
                    {step.status === "active" ? (
                      <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                        {step.step.toLowerCase().includes("memory") || step.step.toLowerCase().includes("memory_read") ? (
                          <Brain className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        ) : step.step.toLowerCase().includes("web_search") || step.step.toLowerCase().includes("web") ? (
                          <Search className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        ) : step.step.toLowerCase().includes("file_read") || step.step.toLowerCase().includes("file") ? (
                          <FileText className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                        ) : step.step.toLowerCase().includes("skill") ? (
                          <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                        ) : step.step.toLowerCase().includes("generat") ? (
                          <Globe className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
                        ) : (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
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
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--accent)]/80 bg-[var(--bg-surface)] border border-white/[0.04] rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
              <Cpu className="w-3 h-3" />
              <span>{traceSteps.filter(s => s.status === "active").length} active step{traceSteps.filter(s => s.status === "active").length !== 1 ? "s" : ""}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/10 flex items-center justify-center mb-5 shadow-lg shadow-[var(--accent)]/10">
              <Bot className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1.5">Welcome to Nexus</h2>
            <p className="text-sm text-gray-500 max-w-md leading-relaxed">
              Your personal AI agent is ready. Start a conversation, use /commands for skills, or drag and drop files to share.
            </p>
          </div>
        )}

        {displayMessages.map((msg, idx) => (
          <div key={msg.id} className={cn("flex gap-3 max-w-4xl mx-auto", msg.role === "user" ? "justify-end" : "justify-start", msg.isProactive ? "animate-slideDown" : "animate-fade-in")}>
            {msg.role !== "user" && (
              <div className={cn("flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5",
                msg.role === "system" ? "bg-red-500/10" : "bg-[var(--accent)]/15")}>
                <Bot className={cn("w-4 h-4", msg.role === "system" ? "text-red-400" : "text-[var(--accent)]")} />
              </div>
            )}
            <div className={cn("max-w-2xl rounded-xl px-4 py-2.5 relative",
              msg.isProactive ? "bg-[var(--bg-surface)] text-gray-200 border-l-2 border-l-[var(--accent)] border border-white/[0.04]"
              : msg.role === "user" ? "bg-[var(--accent)]/15 text-white border border-[var(--accent)]/20"
                : msg.role === "system" ? "bg-red-500/10 text-red-300 border border-red-500/20"
                : "bg-[var(--bg-surface)] text-gray-200 border border-white/[0.04]")}>
              {msg.isProactive && (
                <div style={{ position: "absolute", top: 6, right: 10, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--accent)", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  NEXUS reached out
                </div>
              )}
              {msg.role === "user" ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              ) : (
                renderContent(msg)
              )}
              {/* Thinking dots */}
              {msg.streaming && !msg.content && (
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" style={{"animationDelay": "0.2s"}} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" style={{"animationDelay": "0.4s"}} />
                </div>
              )}
              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {msg.toolCalls.map((tc, tIdx) => (
                    <div key={tIdx} className="border border-white/[0.06] rounded-lg overflow-hidden bg-[var(--bg-surface)]">
                      <button onClick={() => toggleToolCall(idx, tIdx)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.03] transition-colors">
                        {tc.tool.includes("memory") ? <Brain className="w-3 h-3 text-emerald-400" />
                          : tc.tool.includes("web_search") || tc.tool.includes("search") ? <Search className="w-3 h-3 text-amber-400" />
                          : tc.tool.includes("file") || tc.tool.includes("read") ? <FileText className="w-3 h-3 text-blue-400" />
                          : tc.tool.includes("skill") ? <Zap className="w-3 h-3 text-yellow-400" />
                          : <Zap className="w-3 h-3 text-amber-400" />}
                        <span className="font-mono text-amber-300/80">{tc.tool}</span>
                        {tc.expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                      </button>
                      {tc.expanded && (
                        <div className="px-3 py-2 bg-[var(--bg-surface)] text-xs font-mono text-gray-400 border-t border-white/[0.06]">
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
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--bg-raised)] flex items-center justify-center mt-0.5">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-raised)]/90 backdrop-blur border border-white/[0.1] rounded-full text-xs text-gray-300 hover:bg-[var(--bg-raised)] transition-colors shadow-lg">
            <ArrowDown className="w-3 h-3" /> New messages
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)", backdropFilter: "blur(12px)" }} className="px-4 py-3">
        <div className="flex gap-2.5 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Message Nexus... (/ for commands)" rows={1}
              className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-[var(--accent)]/40 focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
              style={{"minHeight": "42px", "maxHeight": "200px"}} />
          </div>
          <button onClick={sendMessage} disabled={!input.trim() || isStreaming}
            className={cn("flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
              input.trim() && !isStreaming
                ? "bg-[var(--accent)] hover:bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25"
                : "bg-[var(--bg-raised)] text-gray-600 cursor-not-allowed")}>
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
