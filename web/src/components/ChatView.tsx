'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Bot, User, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { nexusWS, type WSMessage } from '@/lib/websocket';
import { cn, formatTimestamp } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
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
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    nexusWS.connect();

    const unsubConnect = nexusWS.on('connected', () => setConnected(true));
    const unsubDisconnect = nexusWS.on('disconnected', () => setConnected(false));
    const unsubHello = nexusWS.on('hello-ok', () => setConnected(true));

    const unsubStream = nexusWS.on('chat-stream', (msg: WSMessage) => {
      const payload = msg.payload as { content: string; done: boolean };
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + payload.content },
          ];
        }
        return [
          ...prev,
          {
            id: msg.id || String(Date.now()),
            role: 'assistant',
            content: payload.content,
            timestamp: Date.now(),
            streaming: true,
          },
        ];
      });
      scrollToBottom();
    });

    const unsubDone = nexusWS.on('chat-done', (msg: WSMessage) => {
      const payload = msg.payload as { model?: string; provider?: string; latency_ms?: number };
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, streaming: false, model: payload.model, provider: payload.provider, latency_ms: payload.latency_ms },
          ];
        }
        return prev;
      });
      setIsStreaming(false);
      scrollToBottom();
    });

    const unsubError = nexusWS.on('chat-error', (msg: WSMessage) => {
      const payload = msg.payload as { error: string };
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'system',
          content: `Error: ${payload.error}`,
          timestamp: Date.now(),
        },
      ]);
      setIsStreaming(false);
    });

    const unsubToolCall = nexusWS.on('tool-call', (msg: WSMessage) => {
      const payload = msg.payload as { tool: string; input: Record<string, unknown> };
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          const toolCalls = [...(last.toolCalls || []), { tool: payload.tool, input: payload.input }];
          return [...prev.slice(0, -1), { ...last, toolCalls }];
        }
        return prev;
      });
    });

    const unsubProactive = nexusWS.on('proactive', (msg: WSMessage) => {
      const payload = msg.payload as { message: string };
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: payload.message,
          timestamp: Date.now(),
        },
      ]);
      scrollToBottom();
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubHello();
      unsubStream();
      unsubDone();
      unsubError();
      unsubToolCall();
      unsubProactive();
    };
  }, [scrollToBottom]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      },
    ]);

    setIsStreaming(true);
    nexusWS.sendChat(trimmed);
    setInput('');
    inputRef.current?.focus();
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleToolCall = (msgIdx: number, toolIdx: number) => {
    setMessages(prev =>
      prev.map((msg, i) => {
        if (i !== msgIdx || !msg.toolCalls) return msg;
        const toolCalls = msg.toolCalls.map((tc, j) =>
          j === toolIdx ? { ...tc, expanded: !tc.expanded } : tc
        );
        return { ...msg, toolCalls };
      })
    );
  };

  const renderContent = (content: string) => {
    // Simple markdown-like rendering for code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3);
        const firstNewline = lines.indexOf('\n');
        const lang = firstNewline > 0 ? lines.slice(0, firstNewline).trim() : '';
        const code = firstNewline > 0 ? lines.slice(firstNewline + 1) : lines;
        return (
          <pre key={i} className="my-3 relative group">
            {lang && (
              <div className="text-xs text-gray-500 mb-2">{lang}</div>
            )}
            <code>{code}</code>
            <button
              onClick={() => copyToClipboard(code, `code-${i}`)}
              className="absolute top-2 right-2 p-1.5 rounded bg-surface-3 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copiedId === `code-${i}` ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
          </pre>
        );
      }
      // Handle inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((ip, j) => {
            if (ip.startsWith('`') && ip.endsWith('`')) {
              return (
                <code key={j} className="px-1.5 py-0.5 bg-surface-3 rounded text-sm text-nexus-300">
                  {ip.slice(1, -1)}
                </code>
              );
            }
            return <span key={j}>{ip}</span>;
          })}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-gray-800/50 bg-surface-1/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Chat</h1>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs',
            connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          )}>
            <div className={cn(
              'w-1.5 h-1.5 rounded-full',
              connected ? 'bg-green-400' : 'bg-red-400'
            )} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-nexus-600/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-nexus-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Welcome to Nexus</h2>
            <p className="text-gray-400 max-w-md">
              Your personal AI agent is ready. Start a conversation, use /commands for skills,
              or drag and drop files to share.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 animate-fade-in',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role !== 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-nexus-600/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-nexus-400" />
              </div>
            )}

            <div className={cn(
              'max-w-2xl rounded-xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-nexus-600/20 text-white'
                : msg.role === 'system'
                ? 'bg-red-500/10 text-red-300'
                : 'bg-surface-2 text-gray-200'
            )}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderContent(msg.content)}
                {msg.streaming && (
                  <span className="inline-block w-2 h-4 bg-nexus-400 animate-pulse-soft ml-0.5" />
                )}
              </div>

              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.toolCalls.map((tc, tIdx) => (
                    <div key={tIdx} className="border border-gray-700/50 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleToolCall(idx, tIdx)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:bg-surface-3 transition-colors"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span className="font-mono">{tc.tool}</span>
                        {tc.expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                      </button>
                      {tc.expanded && (
                        <div className="px-3 py-2 bg-surface-1 text-xs font-mono text-gray-400 border-t border-gray-700/50">
                          <div className="text-gray-500 mb-1">Input:</div>
                          <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(tc.input, null, 2)}</pre>
                          {tc.output && (
                            <>
                              <div className="text-gray-500 mt-2 mb-1">Output:</div>
                              <pre className="text-gray-300 whitespace-pre-wrap">{tc.output}</pre>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Message metadata */}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>{formatTimestamp(msg.timestamp)}</span>
                {msg.model && <span className="font-mono">{msg.model}</span>}
                {msg.latency_ms && <span>{msg.latency_ms}ms</span>}
                {msg.role === 'assistant' && !msg.streaming && (
                  <button
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="hover:text-gray-300 transition-colors"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-800/50 bg-surface-1/50 backdrop-blur-sm">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Nexus... (/ for commands)"
              rows={1}
              className="w-full px-4 py-3 bg-surface-2 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl transition-all',
              input.trim() && !isStreaming
                ? 'bg-nexus-600 hover:bg-nexus-500 text-white'
                : 'bg-surface-3 text-gray-600 cursor-not-allowed'
            )}
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Zap(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
