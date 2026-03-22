"use client";

import { useState, useEffect, useCallback } from "react";
import { useActivities } from "@/lib/hooks";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799";

interface ActivityItem {
  id: string;
  type: string;
  content: string;
  timestamp: number;
  channel?: string;
  entity_id?: string;
}

interface ActivitySession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  activities: ActivityItem[];
  summary?: string;
}

interface ActivityViewProps {
  onNavigate?: (tab: string, context?: Record<string, string>) => void;
}

export default function ActivityView({ onNavigate }: ActivityViewProps) {
  const [filter, setFilter] = useState("all");
  const { data: activities = [], isLoading: loading } = useActivities(filter);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [summaryCache, setSummaryCache] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<Record<string, boolean>>({});

  // Group activities into sessions (2-hour window)
  useEffect(() => {
    const sorted = [...activities].sort((a: ActivityItem, b: ActivityItem) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const grouped: ActivitySession[] = [];
    let current: ActivitySession | null = null;
    for (const act of sorted) {
      const ts = act.timestamp ?? Date.now();
      if (!current || (current.startTime - ts) > TWO_HOURS) {
        current = { id: `session-${grouped.length}`, startTime: ts, endTime: ts, duration: 0, activities: [act] };
        grouped.push(current);
      } else {
        current.activities.push(act);
        current.startTime = Math.min(current.startTime, ts);
        current.endTime = Math.max(current.endTime, ts);
        current.duration = current.endTime - current.startTime;
      }
    }
    setSessions(grouped);
  }, [activities]);

  // Generate LLM summary for a session (cached)
  const generateSummary = useCallback(async (session: ActivitySession) => {
    if (summaryCache[session.id]) return;
    if (loadingSummary[session.id]) return;
    setLoadingSummary(prev => ({ ...prev, [session.id]: true }));
    try {
      const res = await fetch(`${GATEWAY}/api/v1/activity/sessions/summarize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: session.activities.map(a => ({ type: a.type, content: a.content })) }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryCache(prev => ({ ...prev, [session.id]: data.summary || "Activity session" }));
      }
    } catch { /* ignore */ }
    finally { setLoadingSummary(prev => ({ ...prev, [session.id]: false })); }
  }, [summaryCache, loadingSummary]);

  // Auto-generate summaries for visible sessions
  useEffect(() => {
    for (const session of sessions.slice(0, 5)) {
      if (!summaryCache[session.id] && !loadingSummary[session.id] && session.activities.length > 0) {
        generateSummary(session);
      }
    }
  }, [sessions, summaryCache, loadingSummary, generateSummary]);

  const filtered = filter === "all" ? activities : activities.filter((a: ActivityItem) => {
    if (filter === "conversations") return a.type === "chat";
    if (filter === "memories") return a.type === "memory";
    if (filter === "skills") return a.type === "skill";
    if (filter === "proactive") return a.type === "proactive";
    return true;
  });

  const filteredSessions = sessions.map(s => ({
    ...s,
    activities: s.activities.filter((a: ActivityItem) => {
      if (filter === "all") return true;
      if (filter === "conversations") return a.type === "chat";
      if (filter === "memories") return a.type === "memory";
      if (filter === "skills") return a.type === "skill";
      if (filter === "proactive") return a.type === "proactive";
      return true;
    }),
  })).filter(s => s.activities.length > 0);

  const handleActivityClick = (item: ActivityItem) => {
    if (!onNavigate) return;
    if (item.type === "memory") {
      onNavigate("memory", { highlightNode: item.entity_id || item.id });
    } else if (item.type === "skill") {
      onNavigate("skills", { scrollTo: item.entity_id || item.content });
    } else if (item.type === "chat") {
      onNavigate("chat", { scrollToMessage: item.entity_id || item.id });
    } else {
      onNavigate("chat");
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 60000) return "< 1m";
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "chat": return "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
      case "memory": return "M12 2v3M12 19v3M2 12h3M19 12h3";
      case "skill": return "M13 2L3 14h9l-1 8 10-12h-9l1-8";
      case "proactive": return "M12 2v3M12 19v3M2 12h3M19 12h3";
      default: return "M12 2v20M2 12h20";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        height: 48, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 10,
        background: "rgba(12,14,18,0.6)", backdropFilter: "blur(12px)",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(45,140,255,0.38)" strokeWidth="1.8">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style={{ color: "var(--text-2)", fontSize: 12.5, fontWeight: 500, flex: 1 }}>Activity</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "memories", "skills", "conversations", "proactive"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "3px 10px", borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer",
                fontFamily: "var(--font-mono)", textTransform: "capitalize",
                background: filter === f ? "var(--accent-mid)" : "transparent",
                color: filter === f ? "var(--accent)" : "var(--text-3)",
                border: filter === f ? "1px solid rgba(45,140,255,0.15)" : "1px solid transparent",
              }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
            <span style={{ fontSize: 13 }}>Loading activity...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
            <p style={{ fontSize: 14, color: "var(--text-2)" }}>No activity yet</p>
            <p style={{ fontSize: 12 }}>Your interactions will appear here</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredSessions.map((session) => (
              <div key={session.id}>
                {/* Session header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "6px 0" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>
                    {new Date(session.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                    {formatDuration(session.duration)} · {session.activities.length} items
                  </div>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                {/* Session summary */}
                {(summaryCache[session.id] || loadingSummary[session.id]) && (
                  <div style={{ padding: "6px 12px", marginBottom: 8, fontSize: 12, color: "var(--text-2)", fontStyle: "italic", background: "rgba(45,140,255,0.03)", borderRadius: "var(--r-sm)", borderLeft: "2px solid rgba(45,140,255,0.2)" }}>
                    {loadingSummary[session.id] ? "Generating summary..." : summaryCache[session.id]}
                  </div>
                )}
                {/* Session activities */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {session.activities.map((item: ActivityItem) => (
                    <div key={item.id} onClick={() => handleActivityClick(item)} style={{
                      display: "flex", gap: 12, padding: "10px 12px",
                      borderRadius: "var(--r-sm)", transition: "background 0.1s",
                      cursor: onNavigate ? "pointer" : "default",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "var(--r-sm)",
                        background: "var(--bg-raised)", border: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 2,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8">
                          <path d={typeIcon(item.type)}/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.content}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                          <span>{item.type}</span>
                          {item.channel && <span>{item.channel}</span>}
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
