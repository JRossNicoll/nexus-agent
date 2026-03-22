"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRight, ArrowLeft, Check, AlertCircle, Brain, MessageSquare,
  Sparkles, User, Loader2, SkipForward, ExternalLink, Bot, X, HelpCircle,
} from "lucide-react";
import { onboardingAPI, providerAPI, memoryAPI, type MemoryGraphDataWithClusters } from "@/lib/api";
import * as d3 from "d3";

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface OnboardingData {
  userName: string;
  provider: string;
  apiKey: string;
  keyName: string;
  keyTested: boolean;
  telegramToken: string;
  aboutWork: string;
  aboutGoals: string;
  aboutGoodDay: string;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    userName: "",
    provider: "anthropic",
    apiKey: "",
    keyName: "anthropic",
    keyTested: false,
    telegramToken: "",
    aboutWork: "",
    aboutGoals: "",
    aboutGoodDay: "",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showApiKeyGuide, setShowApiKeyGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [loadingWelcome, setLoadingWelcome] = useState(false);
  const [graphData, setGraphData] = useState<MemoryGraphDataWithClusters | null>(null);
  const graphRef = useRef<SVGSVGElement>(null);

  const canProceed = useCallback(() => {
    switch (step) {
      case 0: return data.userName.trim().length > 0;
      case 1: return data.keyTested && testResult?.success === true;
      case 2: return true; // skip is always allowed
      case 3: return true; // all optional
      case 4: return true;
      default: return false;
    }
  }, [step, data.userName, data.keyTested, testResult]);

  const handleTestKey = async () => {
    if (!data.apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await providerAPI.testKey(data.provider, data.apiKey);
      setTestResult({ success: result.success, error: result.error });
      if (result.success) {
        setData(d => ({ ...d, keyTested: true }));
      }
    } catch (err: unknown) {
      const e = err as { message: string };
      setTestResult({ success: false, error: e.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      // Submit onboarding data
      await onboardingAPI.complete({
        userName: data.userName,
        provider: {
          primary: data.provider === "anthropic" ? "anthropic/claude-sonnet-4-6" :
                   data.provider === "openai" ? "openai/gpt-4o" :
                   "openrouter/anthropic/claude-3.5-sonnet",
          apiKey: data.apiKey,
          keyName: data.keyName,
        },
        channels: data.telegramToken ? { telegram: { botToken: data.telegramToken } } : undefined,
        aboutYou: {
          work: data.aboutWork || undefined,
          goals: data.aboutGoals || undefined,
          goodDay: data.aboutGoodDay || undefined,
        },
      });

      // Move to final screen
      setStep(4);

      // Load graph data and welcome message separately so one failure doesn't block the other
      setLoadingWelcome(true);
      try {
        const graph = await memoryAPI.getGraph({ cluster: "true" });
        setGraphData(graph);
      } catch (graphErr) {
        console.error("Graph load error:", graphErr);
      }
      try {
        const welcome = await onboardingAPI.getWelcome();
        setWelcomeMsg(welcome.message);
      } catch {
        setWelcomeMsg("Welcome to MEDO! I'm ready to help you.");
      } finally {
        setLoadingWelcome(false);
      }
    } catch (err: unknown) {
      const e = err as { message: string };
      console.error("Onboarding error:", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 3) {
      handleComplete();
    } else if (step === 4) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step > 0 && step < 4) setStep(s => s - 1);
  };

  // Mini graph for screen 5
  useEffect(() => {
    if (step !== 4 || !graphData || !graphRef.current) return;
    const svg = d3.select(graphRef.current);
    svg.selectAll("*").remove();
    const width = 320;
    const height = 220;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    interface MiniNode extends d3.SimulationNodeDatum {
      id: string;
      content: string;
      category: string;
      radius: number;
    }
    interface MiniLink extends d3.SimulationLinkDatum<MiniNode> {
      weight: number;
    }

    const nodes: MiniNode[] = graphData.nodes.map(n => ({
      id: n.id, content: n.content, category: n.category,
      radius: 6 + Math.random() * 4,
    }));
    const links: MiniLink[] = graphData.edges.map(e => ({
      source: e.source, target: e.target, weight: e.weight,
    }));

    const catColors: Record<string, string> = {
      fact: "#ff3333", preference: "#ff5555", event: "#ff7777",
      document: "#cc2222", insight: "#ebb95a",
    };

    const sim = d3.forceSimulation<MiniNode>(nodes)
      .force("link", d3.forceLink<MiniNode, MiniLink>(links).id(d => d.id).distance(40))
      .force("charge", d3.forceManyBody<MiniNode>().strength(-60))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<MiniNode>().radius(d => d.radius + 2));

    const linkEls = svg.append("g")
      .selectAll("line").data(links).join("line")
      .attr("stroke", "#ffffff10").attr("stroke-width", 1);

    const nodeEls = svg.append("g")
      .selectAll("circle").data(nodes).join("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => catColors[d.category] || "#ff3333")
      .attr("opacity", 0.8)
      .attr("stroke", "#ffffff15").attr("stroke-width", 1);

    // Labels for nodes
    const labelEls = svg.append("g")
      .selectAll("text").data(nodes).join("text")
      .text(d => d.content.slice(0, 20) + (d.content.length > 20 ? "..." : ""))
      .attr("fill", "#9ca3af").attr("font-size", "6px")
      .attr("text-anchor", "middle").attr("dy", d => d.radius + 10);

    sim.on("tick", () => {
      linkEls
        .attr("x1", d => (d.source as MiniNode).x ?? 0)
        .attr("y1", d => (d.source as MiniNode).y ?? 0)
        .attr("x2", d => (d.target as MiniNode).x ?? 0)
        .attr("y2", d => (d.target as MiniNode).y ?? 0);
      nodeEls.attr("cx", d => d.x ?? 0).attr("cy", d => d.y ?? 0);
      labelEls.attr("x", d => d.x ?? 0).attr("y", d => d.y ?? 0);
    });

    return () => { sim.stop(); };
  }, [step, graphData]);

  // Progress indicator
  const steps = ["Welcome", "Provider", "Channels", "About You", "Ready"];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300
                ${i < step ? "bg-[var(--accent)] text-white" :
                  i === step ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-2 ring-[var(--accent)]/40" :
                  "bg-[var(--bg-surface)] text-gray-600"}
              `}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px transition-colors duration-300 ${i < step ? "bg-[var(--accent)]/50" : "bg-white/[0.06]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-white/[0.06] overflow-hidden">
          {/* Screen 1: Welcome */}
          {step === 0 && (
            <div className="p-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 animate-pulse">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome to MEDO</h1>
              <p className="text-gray-400 text-center text-sm mb-8">
                Your personal AI agent that learns, remembers, and proactively helps you.
              </p>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">What should I call you?</label>
                <input
                  type="text"
                  value={data.userName}
                  onChange={e => setData(d => ({ ...d, userName: e.target.value }))}
                  placeholder="Your name"
                  className="w-full bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/40 transition-all"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && canProceed()) nextStep(); }}
                />
              </div>
            </div>
          )}

          {/* Screen 2: Choose your brain */}
          {step === 1 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="w-6 h-6 text-[var(--accent)]" />
                <h2 className="text-xl font-bold text-white">Choose your brain</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Select an AI provider. We recommend Anthropic Claude for the best experience.
              </p>

              {/* Provider cards */}
              <div className="space-y-3 mb-6">
                {[
                  { id: "anthropic", name: "Anthropic Claude", desc: "Recommended \u2014 thoughtful, nuanced, safety-first", keyName: "anthropic", badge: "Recommended" },
                  { id: "openai", name: "OpenAI GPT-4", desc: "Fast, versatile, great at coding", keyName: "openai", badge: null },
                  { id: "openrouter", name: "OpenRouter", desc: "Access any model via one API key", keyName: "openrouter", badge: null },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setData(d => ({ ...d, provider: p.id, keyName: p.keyName, apiKey: "", keyTested: false }))}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      data.provider === p.id
                        ? "bg-[var(--accent)]/10 border-[#ff3333]/40 ring-1 ring-[var(--accent)]/20"
                        : "bg-[var(--bg-surface)] border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
                      </div>
                      {p.badge && (
                        <span className="text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded-full">{p.badge}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* API Key input */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">API Key</label>
                  {data.provider === "anthropic" && (
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1">
                      Get a key <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {data.provider === "openai" && (
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1">
                      Get a key <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={data.apiKey}
                    onChange={e => setData(d => ({ ...d, apiKey: e.target.value, keyTested: false }))}
                    placeholder={`sk-...`}
                    className="flex-1 bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all font-mono"
                    onKeyDown={e => { if (e.key === "Enter" && data.apiKey.trim()) handleTestKey(); }}
                  />
                  <button
                    onClick={handleTestKey}
                    disabled={testing || !data.apiKey.trim()}
                    className="px-5 py-3 bg-[var(--accent)] hover:bg-[#cc2222] disabled:bg-[var(--bg-raised)] disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
                  </button>
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`p-3 rounded-xl text-sm flex items-center gap-2 transition-all ${
                  testResult.success
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {testResult.success ? (
                    <>
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      API key verified! Connection working.
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {testResult.error || "Key verification failed"}
                    </>
                  )}
                </div>
              )}

              {/* "I don't have an API key yet" button */}
              <button
                onClick={() => setShowApiKeyGuide(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-400 hover:text-white bg-[var(--bg-raised)]/50 hover:bg-[var(--bg-raised)] border border-white/[0.06] rounded-xl transition-all"
              >
                <HelpCircle className="w-4 h-4" />
                I don&apos;t have an API key yet
              </button>

              {/* API Key Guide Modal */}
              {showApiKeyGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowApiKeyGuide(false)}>
                  <div className="bg-[var(--bg-surface)] border border-white/[0.08] rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                      <h3 className="text-lg font-semibold text-white">How to get an API key</h3>
                      <button onClick={() => setShowApiKeyGuide(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-5 space-y-5">
                      <p className="text-sm text-gray-400 leading-relaxed">
                        An API key is like a password that lets MEDO talk to an AI service.
                        Think of it like giving MEDO permission to use a smart assistant on your behalf.
                        Here&apos;s how to get one:
                      </p>

                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                          <div>
                            <p className="text-sm text-white font-medium">Go to the Anthropic website</p>
                            <p className="text-xs text-gray-400 mt-1">Anthropic is the company that makes Claude, the AI that powers MEDO. Visit their website to create a free account.</p>
                            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-xs text-[var(--accent)] hover:underline">
                              Open console.anthropic.com <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                          <div>
                            <p className="text-sm text-white font-medium">Create a free account</p>
                            <p className="text-xs text-gray-400 mt-1">Click &ldquo;Sign up&rdquo; and create an account using your email address. You&apos;ll need to verify your email. Anthropic gives you free credits to start with.</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                          <div>
                            <p className="text-sm text-white font-medium">Find the API Keys page</p>
                            <p className="text-xs text-gray-400 mt-1">Once you&apos;re logged in, look for &ldquo;API Keys&rdquo; in the left sidebar, or go directly to the link below.</p>
                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-xs text-[var(--accent)] hover:underline">
                              Go to API Keys page <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                          <div>
                            <p className="text-sm text-white font-medium">Create a new key</p>
                            <p className="text-xs text-gray-400 mt-1">Click the &ldquo;Create Key&rdquo; button. Give it a name like &ldquo;MEDO&rdquo; so you remember what it&apos;s for. Click &ldquo;Create&rdquo;.</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                          <div>
                            <p className="text-sm text-white font-medium">Copy and paste the key</p>
                            <p className="text-xs text-gray-400 mt-1">Your new key will appear on screen. It starts with <code className="bg-[var(--bg-raised)] px-1 py-0.5 rounded text-[var(--accent)] text-[11px]">sk-ant-</code>. Click the copy button next to it, then come back here and paste it into the API key field.</p>
                            <p className="text-xs text-amber-400/80 mt-1.5">Important: You can only see the full key once. Make sure to copy it before closing the page.</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowApiKeyGuide(false)}
                        className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white text-sm font-medium rounded-xl transition-all"
                      >
                        Got it, let me enter my key
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screen 3: Connect Telegram */}
          {step === 2 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
                <h2 className="text-xl font-bold text-white">Connect Telegram</h2>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Connect Telegram so MEDO can reach you outside the browser. This is optional.
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Telegram is a free messaging app. Connecting it lets MEDO send you messages and
                respond to you on your phone, even when this browser tab is closed.
              </p>

              <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-white/[0.06] mb-6">
                <h3 className="text-sm font-medium text-white mb-3">Setup Instructions</h3>
                <ol className="space-y-3 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Open Telegram and search for <span className="text-white font-medium">@BotFather</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>Send the message <code className="bg-[var(--bg-raised)] px-1.5 py-0.5 rounded text-[var(--accent)] text-xs">/newbot</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Choose a name (e.g. <span className="text-white">My MEDO Bot</span>) and a username (e.g. <span className="text-white">mymedo_bot</span>)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                    <span>BotFather will give you a token. Paste it below.</span>
                  </li>
                </ol>
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-[var(--accent)] hover:text-[var(--accent)]">
                  Open BotFather in Telegram <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Bot Token (optional)</label>
                <input
                  type="text"
                  value={data.telegramToken}
                  onChange={e => setData(d => ({ ...d, telegramToken: e.target.value }))}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="w-full bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all font-mono"
                />
              </div>
            </div>
          )}

          {/* Screen 4: Tell me about yourself */}
          {step === 3 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-[var(--accent)]" />
                <h2 className="text-xl font-bold text-white">Tell me about yourself</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Help MEDO get to know you. Everything here is optional — answer what feels natural.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">What do you do for work?</label>
                  <textarea
                    value={data.aboutWork}
                    onChange={e => setData(d => ({ ...d, aboutWork: e.target.value }))}
                    placeholder="I'm a software engineer at a fintech startup..."
                    rows={2}
                    className="w-full bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">What are you trying to get better at?</label>
                  <textarea
                    value={data.aboutGoals}
                    onChange={e => setData(d => ({ ...d, aboutGoals: e.target.value }))}
                    placeholder="I want to improve my Rust skills and ship side projects faster..."
                    rows={2}
                    className="w-full bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">What does a good day look like for you?</label>
                  <textarea
                    value={data.aboutGoodDay}
                    onChange={e => setData(d => ({ ...d, aboutGoodDay: e.target.value }))}
                    placeholder="A morning run, deep focus time on a hard problem, a good conversation..."
                    rows={2}
                    className="w-full bg-[var(--bg-surface)] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Screen 5: You're ready */}
          {step === 4 && (
            <div className="p-8">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                You&apos;re ready, {data.userName}!
              </h2>
              <p className="text-gray-400 text-center text-sm mb-5">
                Your memories are already taking shape.
              </p>

              {/* Mini memory graph */}
              <div className="bg-[var(--bg-surface)] rounded-xl border border-white/[0.06] p-3 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="text-xs text-gray-400">Your Memory Graph</span>
                </div>
                <svg ref={graphRef} className="w-full" style={{ height: 180 }} />
              </div>

              {/* Welcome message from agent */}
              {loadingWelcome ? (
                <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-white/[0.06] mb-5 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                  <span className="text-sm text-gray-400">MEDO is preparing a message for you...</span>
                </div>
              ) : welcomeMsg && (
                <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-white/[0.06] mb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{welcomeMsg}</p>
                  </div>
                </div>
              )}

              {/* Pre-filled chat message */}
              <div className="bg-[var(--bg-surface)] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
                <input
                  type="text"
                  value="What can you help me with?"
                  readOnly
                  className="flex-1 bg-transparent text-white text-sm outline-none"
                />
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[#cc2222] text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                >
                  Send <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation footer */}
          {step < 4 && (
            <div className="px-8 py-5 border-t border-white/[0.06] flex items-center justify-between bg-[var(--bg-surface)]">
              <div>
                {step > 0 && (
                  <button onClick={prevStep} className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button onClick={nextStep} className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-[var(--bg-raised)]/60 hover:bg-[var(--bg-raised)] border border-white/[0.08] rounded-xl flex items-center gap-1.5 transition-all">
                    Skip for now &mdash; set this up later in Settings
                  </button>
                )}
                <button
                  onClick={nextStep}
                  disabled={!canProceed() || submitting}
                  className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[#cc2222] disabled:bg-[var(--bg-raised)] disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
                  ) : step === 3 ? (
                    <><Sparkles className="w-4 h-4" /> Complete Setup</>
                  ) : (
                    <>Continue <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
