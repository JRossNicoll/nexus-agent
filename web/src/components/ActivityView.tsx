"use client";

import { useState } from "react";
import { useActivities } from "@/lib/hooks";

export default function ActivityView() {
  const [filter, setFilter] = useState("all");
  const { data: activities = [], isLoading: loading } = useActivities(filter);

  const filtered = filter === "all" ? activities : activities.filter((a: any) => a.type === filter);

  const typeIcon = (type: string) => {
    switch (type) {
      case "chat": return "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
      case "memory": return "M12 2v3M12 19v3M2 12h3M19 12h3";
      case "skill": return "M13 2L3 14h9l-1 8 10-12h-9l1-8";
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
          {["all", "chat", "memory", "skill"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "3px 10px", borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer",
                fontFamily: "var(--font-mono)",
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
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
            <p style={{ fontSize: 14, color: "var(--text-2)" }}>No activity yet</p>
            <p style={{ fontSize: 12 }}>Your interactions will appear here</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((item: any) => (
              <div key={item.id} style={{
                display: "flex", gap: 12, padding: "10px 12px",
                borderRadius: "var(--r-sm)", transition: "background 0.1s",
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
        )}
      </div>
    </div>
  );
}
