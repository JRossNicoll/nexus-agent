"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  MessageSquare,
  Brain,
  Zap,
  Settings,
  Activity,
  Command,
  CornerDownLeft,
  X,
} from "lucide-react";
import { memoryAPI, skillsAPI } from "@/lib/api";
import type { SemanticMemory, SkillInfo } from "@/lib/api";
import { nexusWS } from "@/lib/websocket";
import { cn } from "@/lib/utils";

type ResultItem =
  | { type: "view"; label: string; icon: string; view: string }
  | { type: "memory"; label: string; memory: SemanticMemory }
  | { type: "skill"; label: string; skill: SkillInfo }
  | { type: "chat"; label: string; message: string };

interface CommandPaletteProps {
  onNavigate: (view: string) => void;
}

const VIEWS: Array<{ label: string; icon: string; view: string }> = [
  { label: "Chat", icon: "chat", view: "chat" },
  { label: "Memory Graph", icon: "memory", view: "memory" },
  { label: "Skills", icon: "skills", view: "skills" },
  { label: "Activity Feed", icon: "activity", view: "activity" },
  { label: "Settings", icon: "settings", view: "settings" },
];

function ViewIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "chat":
      return <MessageSquare className="w-4 h-4" />;
    case "memory":
      return <Brain className="w-4 h-4" />;
    case "skills":
      return <Zap className="w-4 h-4" />;
    case "activity":
      return <Activity className="w-4 h-4" />;
    case "settings":
      return <Settings className="w-4 h-4" />;
    default:
      return <Search className="w-4 h-4" />;
  }
}

export default function CommandPalette({ onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Search as user types
  useEffect(() => {
    if (!open) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const q = query.trim().toLowerCase();

    // Always show matching views
    const viewResults: ResultItem[] = VIEWS.filter(
      (v) => !q || v.label.toLowerCase().includes(q)
    ).map((v) => ({ type: "view", label: v.label, icon: v.icon, view: v.view }));

    if (!q) {
      setResults(viewResults);
      setSelectedIndex(0);
      return;
    }

    // Add "Send as chat" option
    const chatResult: ResultItem = {
      type: "chat",
      label: `Send: "${query}"`,
      message: query,
    };

    setResults([...viewResults, chatResult]);
    setSelectedIndex(0);

    // Debounced search for memories and skills
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [memories, skills] = await Promise.all([
          memoryAPI.searchMemories(query, 5).catch(() => [] as SemanticMemory[]),
          skillsAPI.getAll().catch(() => [] as SkillInfo[]),
        ]);

        const memoryResults: ResultItem[] = memories.map((m) => ({
          type: "memory" as const,
          label: m.content.slice(0, 80) + (m.content.length > 80 ? "..." : ""),
          memory: m,
        }));

        const filteredSkills = skills.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
        );
        const skillResults: ResultItem[] = filteredSkills.map((s) => ({
          type: "skill" as const,
          label: s.name,
          skill: s,
        }));

        setResults((prev) => {
          const views = prev.filter((r) => r.type === "view");
          const chat = prev.filter((r) => r.type === "chat");
          return [...views, ...memoryResults, ...skillResults, ...chat];
        });
      } catch {
        // Keep existing results
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, open]);

  const executeResult = useCallback(
    (item: ResultItem) => {
      setOpen(false);
      switch (item.type) {
        case "view":
          onNavigate(item.view);
          break;
        case "memory":
          onNavigate("memory");
          break;
        case "skill":
          if (item.skill) {
            skillsAPI.run(item.skill.name).catch(() => {});
            onNavigate("skills");
          }
          break;
        case "chat":
          onNavigate("chat");
          setTimeout(() => {
            nexusWS.sendChat(item.message);
          }, 100);
          break;
      }
    },
    [onNavigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      executeResult(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 bg-surface-1/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-palette-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search memories, skills, views, or type a message..."
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
          />
          {searching && (
            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && query && !searching && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No results found
            </div>
          )}

          {results.map((item, idx) => (
            <button
              key={`${item.type}-${idx}`}
              onClick={() => executeResult(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                idx === selectedIndex
                  ? "bg-indigo-500/10 text-white"
                  : "text-gray-400 hover:bg-white/[0.03]"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  item.type === "view"
                    ? "bg-surface-3"
                    : item.type === "memory"
                    ? "bg-emerald-500/10"
                    : item.type === "skill"
                    ? "bg-amber-500/10"
                    : "bg-indigo-500/10"
                )}
              >
                {item.type === "view" ? (
                  <ViewIcon icon={item.icon} />
                ) : item.type === "memory" ? (
                  <Brain
                    className={cn(
                      "w-4 h-4",
                      idx === selectedIndex
                        ? "text-emerald-400"
                        : "text-emerald-500/60"
                    )}
                  />
                ) : item.type === "skill" ? (
                  <Zap
                    className={cn(
                      "w-4 h-4",
                      idx === selectedIndex
                        ? "text-amber-400"
                        : "text-amber-500/60"
                    )}
                  />
                ) : (
                  <MessageSquare
                    className={cn(
                      "w-4 h-4",
                      idx === selectedIndex
                        ? "text-indigo-400"
                        : "text-indigo-500/60"
                    )}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{item.label}</div>
                <div className="text-[11px] text-gray-600 capitalize">
                  {item.type === "view"
                    ? "Navigate"
                    : item.type === "memory"
                    ? "Memory"
                    : item.type === "skill"
                    ? "Run skill"
                    : "Send message"}
                </div>
              </div>

              {idx === selectedIndex && (
                <div className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                  <CornerDownLeft className="w-3 h-3" />
                  Enter
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[11px] text-gray-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-[10px] border border-white/[0.08]">
                <span className="text-[9px]">
                  <Command className="w-2.5 h-2.5 inline" />
                </span>
                K
              </kbd>
              Toggle
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface-3 rounded text-[10px] border border-white/[0.08]">
                Esc
              </kbd>
              Close
            </span>
          </div>
          <span>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
