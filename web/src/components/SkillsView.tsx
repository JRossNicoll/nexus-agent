"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { nexusWS, type WSMessage } from "@/lib/websocket";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799";

interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  triggers: { type?: string; cron?: string; keyword?: string; value?: string }[];
  last_run?: string;
  last_result?: string;
  run_count?: number;
}

interface SkillRun {
  timestamp: string;
  success: boolean;
  duration_ms: number;
  output?: string;
  error?: string;
}

interface SkillExecutionEvent {
  skill_id: string;
  success: boolean;
  duration_ms: number;
  output_preview: string;
  error?: string;
}

export default function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedName, setGeneratedName] = useState("");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillRuns, setSkillRuns] = useState<Record<string, SkillRun[]>>({});
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [failedSkills, setFailedSkills] = useState<Record<string, { error: string; duration_ms: number }>>({});
  const skillCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${GATEWAY}/api/v1/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  useEffect(() => {
    const unsub = nexusWS.on("skill-suggestion", (msg: WSMessage) => {
      const p = msg.payload as { suggestion: string };
      if (p.suggestion) setSuggestion(p.suggestion);
    });
    return unsub;
  }, []);

  // Listen for skill_execution_complete WS events — update card without page refresh
  useEffect(() => {
    const unsub = nexusWS.on("skill_execution_complete", (msg: WSMessage) => {
      const p = msg.payload as SkillExecutionEvent;
      setRunningSkill(prev => prev === p.skill_id ? null : prev);
      if (p.success) {
        setFailedSkills(prev => { const next = { ...prev }; delete next[p.skill_id]; return next; });
        setSkillRuns(prev => ({
          ...prev,
          [p.skill_id]: [{ timestamp: new Date().toISOString(), success: true, duration_ms: p.duration_ms, output: p.output_preview }, ...(prev[p.skill_id] || []).slice(0, 9)],
        }));
      } else {
        setFailedSkills(prev => ({ ...prev, [p.skill_id]: { error: p.error || "Execution failed", duration_ms: p.duration_ms } }));
        setSkillRuns(prev => ({
          ...prev,
          [p.skill_id]: [{ timestamp: new Date().toISOString(), success: false, duration_ms: p.duration_ms, error: p.error }, ...(prev[p.skill_id] || []).slice(0, 9)],
        }));
      }
    });
    return unsub;
  }, []);

  const generateSkill = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${GATEWAY}/api/v1/skills/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedCode(data.code || data.content || "");
        setGeneratedName(data.name || "new-skill");
      }
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  const installSkill = async () => {
    try {
      const res = await fetch(`${GATEWAY}/api/v1/skills`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: generatedName, content: generatedCode }),
      });
      if (res.ok) {
        setCreating(false); setDescription(""); setGeneratedCode(""); setGeneratedName("");
        fetchSkills();
      }
    } catch { /* ignore */ }
  };

  const runSkill = async (name: string) => {
    setRunningSkill(name);
    setFailedSkills(prev => { const next = { ...prev }; delete next[name]; return next; });
    try {
      const res = await fetch(`${GATEWAY}/api/skills/${encodeURIComponent(name)}/run`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (!data.success) setRunningSkill(null);
        // WS event will handle the UI update
      } else { setRunningSkill(null); }
    } catch { setRunningSkill(null); }
  };

  const formatError = (raw: string): string => {
    if (raw.includes("ECONNREFUSED")) return "Could not connect to the service";
    if (raw.includes("timeout")) return "The operation took too long";
    if (raw.includes("401") || raw.includes("403")) return "Authentication failed";
    if (raw.includes("rate_limit") || raw.includes("429")) return "Rate limited - try again later";
    if (raw.length > 100) return raw.slice(0, 97) + "...";
    return raw;
  };

  const toggleSkill = async (name: string, enabled: boolean) => {
    try {
      await fetch(`${GATEWAY}/api/v1/skills/${name}/toggle`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled } : s));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={{
        height: 48, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 10,
        background: "rgba(12,14,18,0.6)", backdropFilter: "blur(12px)",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(45,140,255,0.38)" strokeWidth="1.8">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <div style={{ color: "var(--text-2)", fontSize: 12.5, fontWeight: 500, flex: 1 }}>Skills</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{skills.length} skills</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {/* Suggestion banner */}
        {suggestion && (
          <div style={{
            padding: "12px 16px", marginBottom: 16,
            background: "rgba(45,140,255,0.06)", border: "1px solid rgba(45,140,255,0.12)",
            borderRadius: "var(--r-md)", display: "flex", alignItems: "center", gap: 12,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <div style={{ flex: 1, fontSize: 13, color: "var(--text-1)" }}>{suggestion}</div>
            <button onClick={() => { setCreating(true); setDescription(suggestion); setSuggestion(null); }}
              style={{ padding: "5px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              Create skill
            </button>
            <button onClick={() => setSuggestion(null)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>&times;</button>
          </div>
        )}

        {/* Skill builder modal */}
        {creating && (
          <div style={{
            marginBottom: 20, padding: 20, background: "var(--bg-surface)",
            border: "1px solid var(--border-mid)", borderRadius: "var(--r-lg)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 12 }}>Create a new skill</div>
            {!generatedCode ? (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>Describe what you want in plain English:</div>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Every Monday morning, summarise my most important memories and send me a briefing..."
                  style={{ width: "100%", minHeight: 80, padding: 12, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-ui)", resize: "vertical", outline: "none" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={generateSkill} disabled={generating || !description.trim()}
                    style={{ padding: "8px 16px", background: generating ? "var(--bg-raised)" : "var(--accent)", color: "white", border: "none", borderRadius: "var(--r-sm)", fontSize: 13, cursor: "pointer" }}>
                    {generating ? "Generating..." : "Generate Skill"}
                  </button>
                  <button onClick={() => { setCreating(false); setDescription(""); }}
                    style={{ padding: "8px 16px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>Generated skill: <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{generatedName}</span></div>
                <pre style={{ padding: 14, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--text-1)", fontSize: 12, fontFamily: "var(--font-mono)", lineHeight: 1.5, overflow: "auto", maxHeight: 300 }}>{generatedCode}</pre>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={installSkill} style={{ padding: "8px 16px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--r-sm)", fontSize: 13, cursor: "pointer" }}>Accept & Install</button>
                  <button onClick={() => { setGeneratedCode(""); }} style={{ padding: "8px 16px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 13, cursor: "pointer" }}>Regenerate</button>
                  <button onClick={() => { setCreating(false); setDescription(""); setGeneratedCode(""); }}
                    style={{ padding: "8px 16px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skills grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {skills.map(skill => {
            const isFailed = !!failedSkills[skill.name];
            const isRunning = runningSkill === skill.name;
            const failure = failedSkills[skill.name];
            return (
            <div key={skill.name} ref={el => { skillCardRefs.current[skill.name] = el; }} className={isRunning ? "skill-sweep" : ""} data-skill-name={skill.name} style={{
              padding: "14px 16px", background: "var(--bg-surface)",
              border: isFailed ? "1px solid rgba(235,185,90,0.4)" : "1px solid var(--border)", borderRadius: "var(--r-md)",
              display: "flex", flexDirection: "column", gap: 8, position: "relative", transition: "border-color 0.3s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isFailed ? "rgba(235,185,90,0.75)" : "var(--accent)"} strokeWidth="1.8">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.name}</div>
                <button onClick={() => toggleSkill(skill.name, !skill.enabled)}
                  style={{ width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer", position: "relative",
                    background: skill.enabled ? "var(--accent)" : "var(--bg-raised)",
                  }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 2,
                    left: skill.enabled ? 16 : 2, transition: "left 0.2s",
                  }} />
                </button>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                {skill.description || "No description"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                {skill.triggers?.map((t, i) => (
                  <span key={i} style={{ padding: "2px 6px", background: "var(--bg-raised)", borderRadius: 4, border: "1px solid var(--border)" }}>
                    {t.cron ? `cron: ${t.cron}` : t.keyword ? `keyword: ${t.keyword}` : t.type ? `${t.type}: ${t.value || "manual"}` : "manual"}
                  </span>
                ))}
              </div>
              {/* Failure UI */}
              {isFailed && failure && (
                <div style={{ marginTop: 4, padding: "8px 10px", background: "rgba(235,185,90,0.06)", borderRadius: "var(--r-sm)", border: "1px solid rgba(235,185,90,0.15)" }}>
                  <div style={{ fontSize: 11, color: "rgba(235,185,90,0.85)", marginBottom: 6 }}>{formatError(failure.error)}</div>
                  <button onClick={() => runSkill(skill.name)} style={{ padding: "4px 12px", background: "rgba(235,185,90,0.12)", color: "rgba(235,185,90,0.9)", border: "1px solid rgba(235,185,90,0.25)", borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer" }}>Retry</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button onClick={() => runSkill(skill.name)} disabled={isRunning}
                  style={{ padding: "4px 10px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer" }}>
                  {isRunning ? "Running..." : "Run now"}
                </button>
                <button onClick={() => setExpandedSkill(expandedSkill === skill.name ? null : skill.name)}
                  style={{ padding: "4px 10px", background: "var(--bg-raised)", color: "var(--text-3)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer" }}>
                  History
                </button>
              </div>
              {expandedSkill === skill.name && skillRuns[skill.name] && (
                <div style={{ marginTop: 4, padding: 8, background: "var(--bg-raised)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                  {skillRuns[skill.name].length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>No runs yet</div>
                  ) : (
                    skillRuns[skill.name].map((run, i) => (
                      <div key={i} style={{ padding: "4px 0", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-2)", borderBottom: i < skillRuns[skill.name].length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: run.success ? "#5ec26a" : "rgba(235,185,90,0.75)" }} />
                          <span>{new Date(run.timestamp).toLocaleString()}</span>
                          <span style={{ color: "var(--text-3)" }}>{run.duration_ms}ms</span>
                        </div>
                        {run.output && <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.output.substring(0, 100)}</div>}
                        {run.error && <div style={{ marginTop: 4, fontSize: 10, color: "rgba(235,185,90,0.75)" }}>{formatError(run.error)}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            );
          })}

          {/* Create skill card */}
          <div onClick={() => setCreating(true)} style={{
            padding: "14px 16px", background: "transparent",
            border: "1px dashed var(--border-mid)", borderRadius: "var(--r-md)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, cursor: "pointer", minHeight: 140, transition: "all 0.15s",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--r-sm)", background: "var(--bg-raised)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Create a new skill</div>
          </div>
        </div>
      </div>
    </div>
  );
}
