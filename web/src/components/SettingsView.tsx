"use client";

import { useState, useEffect } from "react";
import { useHealth, useProviderSettings } from "@/lib/hooks";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799";

interface ProviderConfig {
  provider: string;
  model: string;
  api_key_set: boolean;
}

export default function SettingsView() {
  const { data: healthData } = useHealth();
  const { data: providerData } = useProviderSettings();

  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [proactiveInterval, setProactiveInterval] = useState(30);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Sync React Query data into local state
  useEffect(() => {
    if (healthData?.provider) {
      setProvider(prev => prev ?? { provider: healthData.provider.primary || healthData.provider, model: healthData.model || "", api_key_set: true });
      if (healthData.telegram_connected) setTelegramConnected(true);
    }
  }, [healthData]);

  useEffect(() => {
    if (providerData?.provider) {
      setProvider(prev => prev ?? { provider: providerData.provider, model: providerData.model || "", api_key_set: providerData.hasKey ?? true });
    }
  }, [providerData]);

  const saveProvider = async (key: string, prov: string, model: string) => {
    setSaving(true);
    try {
      await fetch(`${GATEWAY}/api/v1/settings/provider`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov, model, api_key: key }),
      });
      setProvider({ provider: prov, model, api_key_set: true });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`${GATEWAY}/api/providers/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const latency = Date.now() - start;
      if (data.success) {
        setTestResult({ success: true, latency });
      } else {
        setTestResult({ success: false, error: data.error || "Failed" });
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || "Connection failed" });
    }
    finally { setTesting(false); }
  };

  const saveTelegram = async () => {
    setSaving(true);
    try {
      await fetch(`${GATEWAY}/api/v1/settings/telegram`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: telegramToken }),
      });
      setTelegramConnected(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const clearData = async () => {
    if (!confirm("This will delete all your data including memories, conversations, and skills. Are you sure?")) return;
    try {
      await fetch(`${GATEWAY}/api/v1/settings/reset`, { method: "POST" });
      window.location.reload();
    } catch { /* ignore */ }
  };

  const sectionStyle = {
    padding: 20, background: "var(--bg-surface)",
    border: "1px solid var(--border)", borderRadius: "var(--r-md)",
    marginBottom: 16,
  };

  const labelStyle = { fontSize: 12, color: "var(--text-2)", marginBottom: 6, display: "block" as const };
  const inputStyle = {
    width: "100%", padding: "8px 12px", background: "var(--bg-input)",
    border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
    color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-ui)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        height: 48, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 10,
        background: "rgba(10,10,10,0.6)", backdropFilter: "blur(12px)",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,51,51,0.38)" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <div style={{ color: "var(--text-2)", fontSize: 12.5, fontWeight: 500 }}>Settings</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, maxWidth: 640 }}>
        {/* Your AI */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>Your AI</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Configure your AI provider and model</div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Provider</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["anthropic", "openai", "openrouter", "ollama"].map(p => (
                <button key={p} onClick={() => setProvider(prev => prev ? { ...prev, provider: p } : { provider: p, model: "", api_key_set: false })}
                  style={{
                    padding: "6px 14px", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer",
                    background: provider?.provider === p ? "var(--accent-mid)" : "var(--bg-raised)",
                    color: provider?.provider === p ? "var(--accent)" : "var(--text-2)",
                    border: provider?.provider === p ? "1px solid rgba(255,51,51,0.2)" : "1px solid var(--border)",
                  }}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Model</label>
            <input type="text" defaultValue={provider?.model || ""} placeholder="claude-sonnet-4-20250514" style={inputStyle}
              onChange={e => setProvider(prev => prev ? { ...prev, model: e.target.value } : null)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>API Key</label>
            <input type="password" placeholder={provider?.api_key_set ? "Key is set" : "Enter API key"} style={inputStyle}
              onBlur={e => { if (e.target.value && provider) saveProvider(e.target.value, provider.provider, provider.model); }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {provider?.api_key_set && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5ec26a" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5ec26a" }} />
                Connected
              </div>
            )}
            <button onClick={testConnection} disabled={testing}
              style={{ padding: "6px 14px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>
              {testing ? "Testing..." : "Test connection"}
            </button>
            {testResult && (
              <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: testResult.success ? "#5ec26a" : "#eb645a" }}>
                {testResult.success ? `Connected · ${testResult.latency}ms` : `Failed — check your API key`}
              </span>
            )}
          </div>
        </div>

        {/* Channels */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>Channels</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Connect MEDO to your messaging apps</div>

          <div style={{ padding: "12px 14px", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>Telegram</span>
              {telegramConnected && <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(94,194,106,0.1)", color: "#5ec26a", borderRadius: 4 }}>Connected</span>}
            </div>
            {!telegramConnected && (
              <div>
                <input type="text" value={telegramToken} onChange={e => setTelegramToken(e.target.value)}
                  placeholder="Bot token from @BotFather" style={{ ...inputStyle, marginBottom: 8 }} />
                <button onClick={saveTelegram} disabled={!telegramToken || saving}
                  style={{ padding: "6px 14px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>
                  Connect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Proactive Intelligence */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>Proactive Intelligence</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Control when MEDO reaches out to you</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Enable proactive messages</span>
            <button onClick={() => setProactiveEnabled(!proactiveEnabled)}
              style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative",
                background: proactiveEnabled ? "var(--accent)" : "var(--bg-raised)",
              }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2,
                left: proactiveEnabled ? 18 : 2, transition: "left 0.2s",
              }} />
            </button>
          </div>
          <div>
            <label style={labelStyle}>Check interval (minutes)</label>
            <input type="number" value={proactiveInterval} onChange={e => setProactiveInterval(Number(e.target.value))}
              min="5" max="120" style={{ ...inputStyle, width: 100 }} />
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{ ...sectionStyle, borderColor: "rgba(235,100,90,0.2)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#eb645a", marginBottom: 4 }}>Danger Zone</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Irreversible actions</div>
          <button onClick={clearData}
            style={{ padding: "8px 16px", background: "rgba(235,100,90,0.08)", color: "#eb645a", border: "1px solid rgba(235,100,90,0.15)", borderRadius: "var(--r-sm)", fontSize: 13, cursor: "pointer" }}>
            Delete all data
          </button>
        </div>
      </div>
    </div>
  );
}
