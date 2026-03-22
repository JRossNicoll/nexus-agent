"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799";

interface Memory {
  id: string;
  content: string;
  category?: string;
  confidence?: number;
  created_at?: string;
  updated_at?: string;
  usage_count?: number;
  source?: string;
  channel?: string;
  type?: string;
}

interface HealthData {
  total_memories: number;
  memories_this_week: number;
  stale_count: number;
  oldest_memory?: string;
  conversation_count?: number;
  cluster_count?: number;
}

interface Cluster {
  label: string;
  count: number;
  nodes: string[];
}

export default function MemoryView() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineValue, setTimelineValue] = useState(100);
  const graphRef = useRef<HTMLDivElement>(null);

  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const url = search
        ? `${GATEWAY}/api/v1/memories/search?q=${encodeURIComponent(search)}&limit=50`
        : `${GATEWAY}/api/v1/memories?limit=50`;
      let res = await fetch(url);
      if (!res.ok && search) {
        res = await fetch(`${GATEWAY}/api/v1/memories?q=${encodeURIComponent(search)}&limit=50`);
      }
      const data = await res.json();
      const mems = Array.isArray(data) ? data : (data.memories || []);
      setMemories(mems);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY}/api/v1/memory/health`);
      if (res.ok) setHealth(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchClusters = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY}/api/v1/memory/clusters`);
      if (res.ok) {
        const data = await res.json();
        setClusters(Array.isArray(data) ? data : (data.clusters || []));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMemories(); fetchHealth(); fetchClusters(); }, [fetchMemories, fetchHealth, fetchClusters]);

  useEffect(() => {
    if (!search) return;
    const timer = setTimeout(() => fetchMemories(), 300);
    return () => clearTimeout(timer);
  }, [search, fetchMemories]);

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`${GATEWAY}/api/v1/memories/${id}`, { method: "DELETE" });
      setMemories(prev => prev.filter(m => m.id !== id));
      setSelectedMemory(null);
    } catch { /* ignore */ }
  };

  const updateMemory = async (id: string, content: string) => {
    try {
      await fetch(`${GATEWAY}/api/v1/memories/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setMemories(prev => prev.map(m => m.id === id ? { ...m, content } : m));
      setEditing(false);
      setSelectedMemory(prev => prev ? { ...prev, content } : null);
    } catch { /* ignore */ }
  };

  const filteredMemories = memories.filter(m => {
    if (timelineValue >= 100) return true;
    if (!m.created_at) return true;
    const created = new Date(m.created_at).getTime();
    const now = Date.now();
    const oldest = memories.reduce((min, mem) => {
      const t = mem.created_at ? new Date(mem.created_at).getTime() : now;
      return t < min ? t : min;
    }, now);
    const range = now - oldest;
    const cutoff = oldest + (range * timelineValue / 100);
    return created <= cutoff;
  });

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return "#5ec26a";
    if (c >= 0.5) return "#ebb95a";
    return "#eb645a";
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
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
        <div style={{ color: "var(--text-2)", fontSize: 12.5, fontWeight: 500, flex: 1 }}>Memory Graph</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
          {filteredMemories.length} memories
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Main graph/list area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Search bar floating top-center */}
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 10, width: "100%", maxWidth: 400, padding: "0 16px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", background: "var(--bg-surface)",
              border: "1px solid var(--border-mid)", borderRadius: "var(--r-md)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search memories by concept..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-ui)" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14 }}>&times;</button>
              )}
            </div>
          </div>

          {/* Memory cards grid */}
          <div ref={graphRef} style={{ width: "100%", height: "100%", padding: "70px 16px 60px", overflowY: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="nxs-spin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(45,140,255,0.2)", borderTopColor: "var(--accent)" }} />
                  <span style={{ fontSize: 13 }}>Loading memories...</span>
                </div>
              </div>
            ) : filteredMemories.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
                <p style={{ fontSize: 14, color: "var(--text-2)", margin: "4px 0" }}>No memories yet</p>
                <p style={{ fontSize: 12, margin: 0 }}>Memories will appear here as you chat with NEXUS</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, maxWidth: 900, margin: "0 auto" }}>
                {filteredMemories.map(mem => (
                  <div key={mem.id} onClick={() => { setSelectedMemory(mem); setEditing(false); }}
                    style={{
                      padding: "12px 14px", background: "var(--bg-surface)",
                      border: selectedMemory?.id === mem.id ? "1px solid rgba(45,140,255,0.3)" : "1px solid var(--border)",
                      borderRadius: "var(--r-md)", cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>
                      {mem.content}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                      {mem.category && <span style={{ padding: "2px 6px", background: "var(--bg-raised)", borderRadius: 4, border: "1px solid var(--border)" }}>{mem.category}</span>}
                      {mem.confidence !== undefined && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: confidenceColor(mem.confidence) }} />
                          {Math.round(mem.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline scrubber */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "10px 20px", background: "var(--bg-base)",
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)", whiteSpace: "nowrap" }}>Timeline</span>
            <input type="range" min="0" max="100" value={timelineValue}
              onChange={e => setTimelineValue(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent)" }} />
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)", minWidth: 30, textAlign: "right" as const }}>{timelineValue}%</span>
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 300, borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)", overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>
          {health && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>Memory Health</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Total", value: health.total_memories },
                  { label: "This week", value: "+" + health.memories_this_week },
                  { label: "Stale", value: health.stale_count },
                  { label: "Clusters", value: health.cluster_count || clusters.length },
                ].map(s => (
                  <div key={s.label} style={{ padding: "8px 10px", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)", fontFamily: "var(--font-mono)" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clusters.length > 0 && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Clusters</div>
              {clusters.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "var(--text-2)" }}>
                  <span>{c.label}</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>{c.count}</span>
                </div>
              ))}
            </div>
          )}

          {selectedMemory ? (
            <div style={{ padding: 16, flex: 1 }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>Memory Detail</div>
              {editing ? (
                <div>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                    style={{ width: "100%", minHeight: 100, padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-mid)", borderRadius: "var(--r-sm)", color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-ui)", resize: "vertical" as const, outline: "none" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => updateMemory(selectedMemory.id, editContent)} style={{ flex: 1, padding: "6px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "6px 12px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.6, marginBottom: 12 }}>{selectedMemory.content}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                    {selectedMemory.category && <div style={{ color: "var(--text-3)" }}>Category: <span style={{ color: "var(--text-2)" }}>{selectedMemory.category}</span></div>}
                    {selectedMemory.confidence !== undefined && <div style={{ color: "var(--text-3)" }}>Confidence: <span style={{ color: confidenceColor(selectedMemory.confidence) }}>{Math.round(selectedMemory.confidence * 100)}%</span></div>}
                    {selectedMemory.source && <div style={{ color: "var(--text-3)" }}>Source: <span style={{ color: "var(--text-2)" }}>{selectedMemory.source}</span></div>}
                    {selectedMemory.created_at && <div style={{ color: "var(--text-3)" }}>Created: <span style={{ color: "var(--text-2)" }}>{new Date(selectedMemory.created_at).toLocaleDateString()}</span></div>}
                    {selectedMemory.usage_count !== undefined && <div style={{ color: "var(--text-3)" }}>Used: <span style={{ color: "var(--text-2)" }}>{selectedMemory.usage_count} times</span></div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => { setEditing(true); setEditContent(selectedMemory.content); }} style={{ flex: 1, padding: "6px 12px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => { if (confirm("Delete this memory?")) deleteMemory(selectedMemory.id); }} style={{ flex: 1, padding: "6px 12px", background: "rgba(235,100,90,0.08)", color: "#eb645a", border: "1px solid rgba(235,100,90,0.15)", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 16, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 12, textAlign: "center" as const }}>
              Click a memory to see details
            </div>
          )}
        </div>
      </div>
      <style>{`
        .nxs-spin { animation: nxsSpin 0.8s linear infinite; }
        @keyframes nxsSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
