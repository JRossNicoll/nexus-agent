"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { nexusWS } from "@/lib/websocket";

interface CommandPaletteProps {
  onNavigate: (tab: string) => void;
}

interface SearchResult {
  type: "memory" | "skill" | "navigate" | "action";
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
}

const navItems: SearchResult[] = [
  { type: "navigate", id: "home", title: "Home", subtitle: "Go to home screen", icon: "home" },
  { type: "navigate", id: "chat", title: "Chat", subtitle: "Open conversation", icon: "chat" },
  { type: "navigate", id: "memory", title: "Memory Graph", subtitle: "View your memories", icon: "brain" },
  { type: "navigate", id: "skills", title: "Skills", subtitle: "Manage your skills", icon: "zap" },
  { type: "navigate", id: "settings", title: "Settings", subtitle: "Configure NEXUS", icon: "settings" },
];

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799";

export default function CommandPalette({ onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>(navItems);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [skills, setSkills] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${GATEWAY}/api/v1/skills`).then(r => r.json()).then((data: unknown) => {
      if (Array.isArray(data)) {
        setSkills(data.map((s: Record<string, unknown>) => ({
          type: "skill" as const, id: String(s.name || s.id), title: String(s.name || "Skill"),
          subtitle: String(s.description || "Run this skill"), icon: "zap",
        })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(prev => !prev); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setSelectedIdx(0); }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    const lower = q.toLowerCase();
    const navR = navItems.filter(n => n.title.toLowerCase().includes(lower) || (n.subtitle || "").toLowerCase().includes(lower));
    const skillR = skills.filter(s => s.title.toLowerCase().includes(lower) || (s.subtitle || "").toLowerCase().includes(lower));
    let memR: SearchResult[] = [];
    if (q.length > 1) {
      try {
        let res = await fetch(`${GATEWAY}/api/v1/memories/search?q=${encodeURIComponent(q)}&limit=5`);
        if (!res.ok) res = await fetch(`${GATEWAY}/api/v1/memories?q=${encodeURIComponent(q)}&limit=5`);
        const data = await res.json();
        const mems = Array.isArray(data) ? data : (data.memories || []);
        memR = mems.slice(0, 5).map((m: Record<string, unknown>) => ({
          type: "memory" as const, id: String(m.id || Math.random()),
          title: String(m.content || m.fact || "Memory").substring(0, 80),
          subtitle: String(m.category || m.type || "memory"), icon: "brain",
        }));
      } catch { /* ignore */ }
    }
    const all = [...navR, ...skillR, ...memR];
    setResults(all.length > 0 ? all : navItems);
    setSelectedIdx(0);
  }, [skills]);

  useEffect(() => {
    if (!query) { setResults([...navItems, ...skills.slice(0, 3)]); setSelectedIdx(0); return; }
    const timer = setTimeout(() => doSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, doSearch, skills]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) { e.preventDefault(); executeResult(results[selectedIdx]); }
  };

  const executeResult = (result: SearchResult) => {
    setOpen(false);
    if (result.type === "navigate") onNavigate(result.id);
    else if (result.type === "skill") fetch(`${GATEWAY}/api/v1/skills/${result.id}/run`, { method: "POST" }).catch(() => {});
    else if (result.type === "memory") onNavigate("memory");
    else if (result.type === "action") { nexusWS.sendChat(result.title); onNavigate("chat"); }
  };

  const groupResults = () => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const label = r.type === "navigate" ? "Navigate" : r.type === "skill" ? "Skills" : r.type === "memory" ? "Memories" : "Actions";
      if (!groups[label]) groups[label] = [];
      groups[label].push(r);
    }
    return groups;
  };

  if (!open) return null;
  const groups = groupResults();
  let flatIdx = 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}
      onClick={() => setOpen(false)}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxHeight: 420, background: "var(--bg-surface)",
        border: "1px solid var(--border-mid)", borderRadius: "var(--r-lg)",
        boxShadow: "0 16px 64px rgba(0,0,0,0.5)", overflow: "hidden", position: "relative",
      }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search memories, skills, or navigate..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-1)", fontSize: 14, fontFamily: "var(--font-ui)" }} />
          <div style={{ fontSize: 10, color: "var(--text-4)", fontFamily: "var(--font-mono)", padding: "2px 6px", background: "var(--bg-raised)", borderRadius: 4, border: "1px solid var(--border)" }}>ESC</div>
        </div>
        <div style={{ maxHeight: 340, overflowY: "auto", padding: "6px 0" }}>
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName}>
              <div style={{ padding: "6px 16px 4px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-4)", textTransform: "uppercase", letterSpacing: 1 }}>{groupName}</div>
              {items.map((item) => {
                const thisIdx = flatIdx++;
                const isSel = thisIdx === selectedIdx;
                return (
                  <div key={item.id + item.type} onClick={() => executeResult(item)} onMouseEnter={() => setSelectedIdx(thisIdx)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", cursor: "pointer",
                      background: isSel ? "var(--accent-low)" : "transparent",
                      borderLeft: isSel ? "2px solid var(--accent)" : "2px solid transparent",
                    }}>
                    <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--bg-raised)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8">
                        {item.icon === "home" && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}
                        {item.icon === "chat" && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>}
                        {item.icon === "brain" && <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>}
                        {item.icon === "zap" && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>}
                        {item.icon === "settings" && <circle cx="12" cy="12" r="3"/>}
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: isSel ? "var(--text-1)" : "var(--text-2)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                      {item.subtitle && <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{item.subtitle}</div>}
                    </div>
                    {isSel && <div style={{ fontSize: 10, color: "var(--text-4)", fontFamily: "var(--font-mono)" }}>Enter</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-4)" }}>
          <span>Navigate</span><span>Select</span><span>esc Close</span>
          <span style={{ marginLeft: "auto" }}>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
