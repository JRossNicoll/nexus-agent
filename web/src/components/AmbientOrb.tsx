"use client";

import { useState, useEffect } from "react";
import { medoWS, type WSMessage } from "@/lib/websocket";

type OrbState = "idle" | "thinking" | "tool" | "proactive";

export default function AmbientOrb() {
  const [state, setState] = useState<OrbState>("idle");
  const [tooltip, setTooltip] = useState("MEDO is ready");
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const unsubs = [
      medoWS.on("chat-stream", () => { setState("thinking"); setTooltip("Thinking..."); }),
      medoWS.on("chat-done", () => { setState("idle"); setTooltip("MEDO is ready"); }),
      medoWS.on("chat-error", () => { setState("idle"); setTooltip("MEDO is ready"); }),
      medoWS.on("tool-call", () => { setState("tool"); setTooltip("Running a task..."); }),
      medoWS.on("execution-trace", (msg: WSMessage) => {
        const p = msg.payload as { step: string; status: string };
        if (p.status === "active") { setState("thinking"); setTooltip(p.step); }
        else if (p.status === "done") { setTimeout(() => { setState(s => s === "thinking" ? "idle" : s); setTooltip("MEDO is ready"); }, 1000); }
      }),
      medoWS.on("trace_step", (msg: WSMessage) => {
        const p = msg.payload as { step: string; status: string };
        if (p.status === "active") { setState("thinking"); setTooltip(p.step); }
        else if (p.status === "done") { setTimeout(() => { setState(s => s === "thinking" ? "idle" : s); setTooltip("MEDO is ready"); }, 1000); }
      }),
      medoWS.on("proactive", () => {
        setState("proactive"); setTooltip("I have something for you");
        setTimeout(() => { setState("idle"); setTooltip("MEDO is ready"); }, 5000);
      }),
      medoWS.on("reconnecting", () => { setTooltip("Reconnecting..."); }),
      medoWS.on("reconnected", () => { setTooltip("MEDO is ready"); }),
    ];
    return () => { unsubs.forEach(u => u()); };
  }, []);

  const cls = state === "thinking" ? "norb-think" : state === "tool" ? "norb-tool" : state === "proactive" ? "norb-pro" : "norb-idle";

  return (
    <div style={{ position: "fixed", bottom: 26, right: 26, zIndex: 100 }}
      onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      {showTooltip && (
        <div style={{
          position: "absolute", bottom: "100%", right: 0, marginBottom: 8,
          padding: "6px 12px", background: "var(--bg-raised)",
          border: "1px solid var(--border-mid)", borderRadius: "var(--r-sm)",
          fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-2)",
          whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>{tooltip}</div>
      )}
      <div className={cls} style={{
        width: 42, height: 42, borderRadius: "50%",
        background: "rgba(255,51,51,0.06)", border: "1px solid rgba(255,51,51,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      }}>
        <div style={{
          width: 15, height: 15, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(255,51,51,0.78) 60%, rgba(200,100,100,0.3) 100%)",
          filter: "blur(0.8px)",
        }} />
      </div>
      <style>{`
        .norb-idle { animation: norbIdle 4s ease-in-out infinite; box-shadow: 0 0 18px rgba(255,51,51,0.07); }
        .norb-think { animation: norbThink 1.5s ease-in-out infinite; }
        .norb-tool { animation: norbTool 1s ease-in-out infinite; border-color: rgba(255,51,51,0.25) !important; background: rgba(255,51,51,0.10) !important; }
        .norb-pro { animation: norbPro 2s ease-in-out infinite; border-color: rgba(235,185,90,0.2) !important; }
        @keyframes norbIdle { 0%,100% { box-shadow:0 0 18px rgba(255,51,51,0.07); transform:scale(1); } 50% { box-shadow:0 0 26px rgba(255,51,51,0.10); transform:scale(1.025); } }
        @keyframes norbThink { 0%,100% { box-shadow:0 0 24px rgba(255,51,51,0.18); transform:scale(1); } 50% { box-shadow:0 0 40px rgba(255,51,51,0.35); transform:scale(1.06); } }
        @keyframes norbTool { 0%,100% { box-shadow:0 0 20px rgba(255,51,51,0.22); } 50% { box-shadow:0 0 36px rgba(255,51,51,0.45); } }
        @keyframes norbPro { 0%,100% { box-shadow:0 0 15px rgba(235,185,90,0.15); } 50% { box-shadow:0 0 30px rgba(235,185,90,0.30); } }
      `}</style>
    </div>
  );
}
