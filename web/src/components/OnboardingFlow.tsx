"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRight, ArrowLeft, Check, AlertCircle, Brain, MessageSquare,
  Sparkles, User, Loader2, SkipForward, ExternalLink, Bot,
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
        setWelcomeMsg("Welcome to NEXUS! I'm ready to help you.");
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
      fact: "#6366f1", preference: "#a855f7", event: "#ec4899",
      document: "#3b82f6", insight: "#f59e0b",
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
      .attr("fill", d => catColors[d.category] || "#6366f1")
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
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300
                ${i < step ? "bg-indigo-500 text-white" :
                  i === step ? "bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/40" :
                  "bg-surface-2 text-gray-600"}
              `}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px transition-colors duration-300 ${i < step ? "bg-indigo-500/50" : "bg-white/[0.06]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface-1 rounded-2xl border border-white/[0.06] overflow-hidden">
          {/* Screen 1: Welcome */}
          {step === 0 && (
            <div className="p-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome to NEXUS</h1>
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
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
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
                <Brain className="w-6 h-6 text-indigo-400" />
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
                        ? "bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20"
                        : "bg-surface-2 border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
                      </div>
                      {p.badge && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">{p.badge}</span>
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
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      Get a key <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {data.provider === "openai" && (
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
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
                    className="flex-1 bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-mono"
                    onKeyDown={e => { if (e.key === "Enter" && data.apiKey.trim()) handleTestKey(); }}
                  />
                  <button
                    onClick={handleTestKey}
                    disabled={testing || !data.apiKey.trim()}
                    className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-surface-3 disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
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
            </div>
          )}

          {/* Screen 3: Connect Telegram */}
          {step === 2 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare className="w-6 h-6 text-indigo-400" />
                <h2 className="text-xl font-bold text-white">Connect Telegram</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Connect Telegram so NEXUS can reach you outside the browser. This is optional.
              </p>

              <div className="bg-surface-2 rounded-xl p-5 border border-white/[0.06] mb-6">
                <h3 className="text-sm font-medium text-white mb-3">Setup Instructions</h3>
                <ol className="space-y-3 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Open Telegram and search for <span className="text-white font-medium">@BotFather</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>Send the message <code className="bg-surface-3 px-1.5 py-0.5 rounded text-indigo-300 text-xs">/newbot</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Choose a name (e.g. <span className="text-white">My NEXUS Bot</span>) and a username (e.g. <span className="text-white">mynexus_bot</span>)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                    <span>BotFather will give you a token. Paste it below.</span>
                  </li>
                </ol>
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-indigo-400 hover:text-indigo-300">
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
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-mono"
                />
              </div>
            </div>
          )}

          {/* Screen 4: Tell me about yourself */}
          {step === 3 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-indigo-400" />
                <h2 className="text-xl font-bold text-white">Tell me about yourself</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Help NEXUS get to know you. Everything here is optional — answer what feels natural.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">What do you do for work?</label>
                  <textarea
                    value={data.aboutWork}
                    onChange={e => setData(d => ({ ...d, aboutWork: e.target.value }))}
                    placeholder="I'm a software engineer at a fintech startup..."
                    rows={2}
                    className="w-full bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">What are you trying to get better at?</label>
                  <textarea
                    value={data.aboutGoals}
                    onChange={e => setData(d => ({ ...d, aboutGoals: e.target.value }))}
                    placeholder="I want to improve my Rust skills and ship side projects faster..."
                    rows={2}
                    className="w-full bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">What does a good day look like for you?</label>
                  <textarea
                    value={data.aboutGoodDay}
                    onChange={e => setData(d => ({ ...d, aboutGoodDay: e.target.value }))}
                    placeholder="A morning run, deep focus time on a hard problem, a good conversation..."
                    rows={2}
                    className="w-full bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all resize-none"
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
              <div className="bg-surface-2 rounded-xl border border-white/[0.06] p-3 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs text-gray-400">Your Memory Graph</span>
                </div>
                <svg ref={graphRef} className="w-full" style={{ height: 180 }} />
              </div>

              {/* Welcome message from agent */}
              {loadingWelcome ? (
                <div className="bg-surface-2 rounded-xl p-4 border border-white/[0.06] mb-5 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-sm text-gray-400">NEXUS is preparing a message for you...</span>
                </div>
              ) : welcomeMsg && (
                <div className="bg-surface-2 rounded-xl p-4 border border-white/[0.06] mb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-indigo-400" />
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{welcomeMsg}</p>
                  </div>
                </div>
              )}

              {/* Pre-filled chat message */}
              <div className="bg-surface-2 rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
                <input
                  type="text"
                  value="What can you help me with?"
                  readOnly
                  className="flex-1 bg-transparent text-white text-sm outline-none"
                />
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                >
                  Send <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation footer */}
          {step < 4 && (
            <div className="px-8 py-5 border-t border-white/[0.06] flex items-center justify-between bg-surface-1/50">
              <div>
                {step > 0 && (
                  <button onClick={prevStep} className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button onClick={nextStep} className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                    <SkipForward className="w-3.5 h-3.5" /> Skip
                  </button>
                )}
                <button
                  onClick={nextStep}
                  disabled={!canProceed() || submitting}
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-surface-3 disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
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
