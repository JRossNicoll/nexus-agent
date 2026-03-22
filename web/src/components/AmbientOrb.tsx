"use client";

import { useState, useEffect } from "react";
import { nexusWS, type WSMessage } from "@/lib/websocket";

type OrbState = "idle" | "thinking" | "tool" | "proactive";

export default function AmbientOrb() {
  const [state, setState] = useState<OrbState>("idle");
  const [tooltip, setTooltip] = useState("Nexus is idle");
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    nexusWS.connect();

    const unsubStream = nexusWS.on("chat-stream", () => {
      setState("thinking");
      setTooltip("Generating response...");
    });

    const unsubDone = nexusWS.on("chat-done", () => {
      setState("idle");
      setTooltip("Nexus is idle");
    });

    const unsubError = nexusWS.on("chat-error", () => {
      setState("idle");
      setTooltip("Nexus is idle");
    });

    const unsubTool = nexusWS.on("tool-call", () => {
      setState("tool");
      setTooltip("Executing a tool...");
    });

    const unsubTrace = nexusWS.on("execution-trace", (msg: WSMessage) => {
      const payload = msg.payload as { step: string; status: string };
      if (payload.status === "active") {
        setState("thinking");
        setTooltip(payload.step);
      } else if (payload.status === "done") {
        // Brief delay before returning to idle
        setTimeout(() => {
          setState((prev) => (prev === "thinking" ? "idle" : prev));
          setTooltip("Nexus is idle");
        }, 1000);
      }
    });

    const unsubProactive = nexusWS.on("proactive", () => {
      setState("proactive");
      setTooltip("Proactive insight ready");
      setTimeout(() => {
        setState("idle");
        setTooltip("Nexus is idle");
      }, 5000);
    });

    return () => {
      unsubStream();
      unsubDone();
      unsubError();
      unsubTool();
      unsubTrace();
      unsubProactive();
    };
  }, []);

  const orbClasses: Record<OrbState, string> = {
    idle: "orb-idle",
    thinking: "orb-thinking",
    tool: "orb-tool",
    proactive: "orb-proactive",
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-50"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-surface-3/95 backdrop-blur border border-white/[0.08] rounded-lg text-xs text-gray-300 whitespace-nowrap animate-fade-in shadow-lg">
          {tooltip}
        </div>
      )}

      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full ${orbClasses[state]}-glow`} />

      {/* Main orb */}
      <div
        className={`relative w-10 h-10 rounded-full cursor-pointer transition-all duration-500 ${orbClasses[state]}`}
      >
        {/* Inner shine */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}
