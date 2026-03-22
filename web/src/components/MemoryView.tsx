"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, Trash2, Edit3, Save, X, Database, Brain, Tag, Clock,
  Eye, Network, Filter, ChevronDown, ChevronUp,
} from "lucide-react";
import { memoryAPI, structuredAPI, type SemanticMemory, type StructuredMemory, type MemoryGraphData } from "@/lib/api";
import { cn, formatTimestamp } from "@/lib/utils";

type MemoryTab = "structured" | "semantic" | "graph";

interface EditingMemory {
  id: string;
  content: string;
  category: string;
  confidence: number;
}

export default function MemoryView() {
  const [activeTab, setActiveTab] = useState<MemoryTab>("structured");
  const [structured, setStructured] = useState<StructuredMemory[]>([]);
  const [semantic, setSemantic] = useState<SemanticMemory[]>([]);
  const [graphData, setGraphData] = useState<MemoryGraphData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ key: "", value: "", category: "preferences", type: "string" });
  const [editingMemory, setEditingMemory] = useState<EditingMemory | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [expandedMemId, setExpandedMemId] = useState<string | null>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "structured") {
        const data = await structuredAPI.getAll();
        setStructured(data);
      } else if (activeTab === "semantic") {
        const data = await memoryAPI.getMemories({ limit: 100, category: filterCategory || undefined });
        setSemantic(data);
      } else {
        try {
          const data = await memoryAPI.getGraph();
          setGraphData(data);
        } catch {
          setGraphData({ nodes: [], edges: [] });
        }
      }
    } catch (err) { console.error("Failed to load memory data:", err); }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadData(); return; }
    setLoading(true);
    try {
      const results = await memoryAPI.searchMemories(searchQuery);
      setSemantic(results);
    } catch (err) { console.error("Search failed:", err); }
    setLoading(false);
  };

  const handleSaveStructured = async (key: string) => {
    try {
      await structuredAPI.set(key, { value: editValue });
      setEditingKey(null);
      loadData();
    } catch (err) { console.error("Save failed:", err); }
  };

  const handleDeleteStructured = async (key: string) => {
    try { await structuredAPI.delete(key); loadData(); }
    catch (err) { console.error("Delete failed:", err); }
  };

  const handleDeleteSemantic = async (id: string) => {
    try {
      await memoryAPI.deleteMemory(id);
      setSemantic(prev => prev.filter(m => m.id !== id));
    } catch (err) { console.error("Delete failed:", err); }
  };

  const handleUpdateMemory = async () => {
    if (!editingMemory) return;
    try {
      await memoryAPI.updateMemory(editingMemory.id, {
        content: editingMemory.content,
        category: editingMemory.category,
        confidence: editingMemory.confidence,
      });
      setEditingMemory(null);
      loadData();
    } catch (err) { console.error("Update failed:", err); }
  };

  const handleAddStructured = async () => {
    if (!newEntry.key || !newEntry.value) return;
    try {
      await structuredAPI.set(newEntry.key, { value: newEntry.value, type: newEntry.type, category: newEntry.category });
      setShowAddForm(false);
      setNewEntry({ key: "", value: "", category: "preferences", type: "string" });
      loadData();
    } catch (err) { console.error("Add failed:", err); }
  };

  const handleConsolidate = async () => {
    try {
      const result = await memoryAPI.consolidate();
      alert(`Consolidation complete: ${result.merged} merged, ${result.flagged} flagged`);
      loadData();
    } catch (err) { console.error("Consolidation failed:", err); }
  };

  // Simple force-directed graph using canvas
  const drawGraph = useCallback(() => {
    const canvas = graphRef.current;
    if (!canvas || !graphData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width = canvas.parentElement?.clientWidth || 800;
    const h = canvas.height = canvas.parentElement?.clientHeight || 600;

    const catColors: Record<string, string> = {
      fact: "#6366f1", preference: "#8b5cf6", event: "#ec4899",
      document: "#06b6d4", insight: "#f59e0b", default: "#64748b",
    };

    // Initialize positions
    const nodes = graphData.nodes.map((n, i) => ({
      ...n,
      x: w/2 + (Math.random() - 0.5) * w * 0.6,
      y: h/2 + (Math.random() - 0.5) * h * 0.6,
      vx: 0, vy: 0,
      radius: 4 + Math.min(n.confidence * 8, 12),
    }));

    const edges = graphData.edges;
    const nodeMap = new Map(nodes.map((n, i) => [n.id, i]));

    // Simple simulation
    for (let iter = 0; iter < 100; iter++) {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
          const force = 800 / (dist * dist);
          nodes[i].vx -= dx/dist * force;
          nodes[i].vy -= dy/dist * force;
          nodes[j].vx += dx/dist * force;
          nodes[j].vy += dy/dist * force;
        }
      }
      // Attraction along edges
      for (const e of edges) {
        const si = nodeMap.get(e.source);
        const ti = nodeMap.get(e.target);
        if (si === undefined || ti === undefined) continue;
        const dx = nodes[ti].x - nodes[si].x;
        const dy = nodes[ti].y - nodes[si].y;
        const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
        const force = dist * 0.01 * e.weight;
        nodes[si].vx += dx/dist * force;
        nodes[si].vy += dy/dist * force;
        nodes[ti].vx -= dx/dist * force;
        nodes[ti].vy -= dy/dist * force;
      }
      // Center gravity
      for (const n of nodes) {
        n.vx += (w/2 - n.x) * 0.001;
        n.vy += (h/2 - n.y) * 0.001;
        n.x += n.vx * 0.5;
        n.y += n.vy * 0.5;
        n.vx *= 0.9;
        n.vy *= 0.9;
        n.x = Math.max(20, Math.min(w-20, n.x));
        n.y = Math.max(20, Math.min(h-20, n.y));
      }
    }

    // Draw
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, w, h);

    // Edges
    for (const e of edges) {
      const si = nodeMap.get(e.source);
      const ti = nodeMap.get(e.target);
      if (si === undefined || ti === undefined) continue;
      ctx.beginPath();
      ctx.moveTo(nodes[si].x, nodes[si].y);
      ctx.lineTo(nodes[ti].x, nodes[ti].y);
      ctx.strokeStyle = `rgba(99, 102, 241, ${Math.min(e.weight * 0.3, 0.4)})`;
      ctx.lineWidth = Math.max(e.weight * 2, 0.5);
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const color = catColors[n.category] || catColors.default;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3 + n.confidence * 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      if (n.radius > 6) {
        ctx.font = "10px Inter, sans-serif";
        ctx.fillStyle = "#94a3b8";
        const label = n.content.slice(0, 30) + (n.content.length > 30 ? "..." : "");
        ctx.fillText(label, n.x + n.radius + 4, n.y + 3);
      }
    }
  }, [graphData]);

  useEffect(() => {
    if (activeTab === "graph") drawGraph();
  }, [activeTab, graphData, drawGraph]);

  const categories = [...new Set(structured.map(s => s.category))].sort();
  const groupedStructured = categories.reduce((acc, cat) => {
    acc[cat] = structured.filter(s => s.category === cat);
    return acc;
  }, {} as Record<string, StructuredMemory[]>);

  const memoryCategories = ["", "fact", "preference", "event", "document", "insight"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white">Memory</h1>
          <div className="flex bg-surface-2/80 rounded-lg p-0.5 border border-white/[0.04]">
            {([
              { id: "structured" as MemoryTab, label: "Structured", icon: Database },
              { id: "semantic" as MemoryTab, label: "Semantic", icon: Brain },
              { id: "graph" as MemoryTab, label: "Graph", icon: Network },
            ]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200",
                  activeTab === t.id
                    ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                    : "text-gray-500 hover:text-gray-300"
                )}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "structured" && (
            <button onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/15 text-indigo-300 rounded-lg text-xs hover:bg-indigo-500/25 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
          {activeTab === "semantic" && (
            <>
              <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); }}
                className="px-2 py-1 bg-surface-2 border border-white/[0.08] rounded-lg text-xs text-gray-400 focus:outline-none">
                <option value="">All categories</option>
                {memoryCategories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={handleConsolidate}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/15 text-amber-300 rounded-lg text-xs hover:bg-amber-500/25 transition-colors">
                Consolidate
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search bar for semantic */}
      {activeTab === "semantic" && (
        <div className="px-6 py-2.5 border-b border-white/[0.06]">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Semantic search across memories..."
                className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-white/[0.08] rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/40" />
            </div>
            <button onClick={handleSearch}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-400 transition-colors">
              Search
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mr-3" />
            Loading...
          </div>
        ) : activeTab === "graph" ? (
          <div className="h-full relative">
            {graphData && graphData.nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-600">
                <Network className="w-12 h-12 mb-3 opacity-40" />
                <p>No memory graph data yet</p>
                <p className="text-xs mt-1">Memories will form a graph as you converse</p>
              </div>
            ) : (
              <>
                <canvas ref={graphRef} className="w-full h-full rounded-xl" />
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  {Object.entries({ fact: "#6366f1", preference: "#8b5cf6", event: "#ec4899", document: "#06b6d4", insight: "#f59e0b" }).map(([k,v]) => (
                    <div key={k} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v }} />
                      {k}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "structured" ? (
          <div className="space-y-6">
            {showAddForm && (
              <div className="bg-surface-2 rounded-xl p-4 border border-indigo-500/20 animate-fade-in">
                <h3 className="text-xs font-semibold text-white mb-3">Add Memory Entry</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={newEntry.key} onChange={e => setNewEntry(p => ({ ...p, key: e.target.value }))}
                    placeholder="Key" className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  <input type="text" value={newEntry.value} onChange={e => setNewEntry(p => ({ ...p, value: e.target.value }))}
                    placeholder="Value" className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  <select value={newEntry.category} onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
                    className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none">
                    <option value="identity">Identity</option><option value="preferences">Preferences</option>
                    <option value="health">Health</option><option value="finance">Finance</option>
                    <option value="relationships">Relationships</option><option value="goals">Goals</option>
                  </select>
                  <select value={newEntry.type} onChange={e => setNewEntry(p => ({ ...p, type: e.target.value }))}
                    className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none">
                    <option value="string">String</option><option value="number">Number</option>
                    <option value="date">Date</option><option value="list">List</option><option value="object">Object</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleAddStructured} className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs">Save</button>
                  <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}

            {categories.length === 0 ? (
              <div className="text-center text-gray-600 py-12">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No structured memories yet</p>
                <p className="text-xs mt-1 text-gray-700">Add facts about yourself to help Nexus remember</p>
              </div>
            ) : (
              categories.map(category => (
                <div key={category}>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">{category}</h3>
                  <div className="space-y-1">
                    {groupedStructured[category].map(entry => (
                      <div key={entry.key} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-lg group hover:bg-surface-3 transition-colors border border-white/[0.02] hover:border-white/[0.06]">
                        <span className="text-xs font-mono text-indigo-400 min-w-32">{entry.key}</span>
                        {editingKey === entry.key ? (
                          <div className="flex-1 flex gap-2">
                            <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                              className="flex-1 px-2 py-1 bg-surface-1 border border-indigo-500/50 rounded text-white text-sm focus:outline-none" autoFocus />
                            <button onClick={() => handleSaveStructured(entry.key)} className="text-green-400 hover:text-green-300"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingKey(null)} className="text-gray-400 hover:text-gray-300"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-300">{entry.value}</span>
                            <span className="text-[10px] text-gray-700">{entry.type}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingKey(entry.key); setEditValue(entry.value); }} className="p-1 text-gray-500 hover:text-white"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteStructured(entry.key)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {semantic.length === 0 ? (
              <div className="text-center text-gray-600 py-12">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No semantic memories yet</p>
                <p className="text-xs mt-1 text-gray-700">Memories are created from conversations</p>
              </div>
            ) : (
              semantic.map(mem => (
                <div key={mem.id} className="bg-surface-2 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-all animate-fade-in">
                  {editingMemory?.id === mem.id ? (
                    <div className="p-4 space-y-3">
                      <textarea value={editingMemory.content} onChange={e => setEditingMemory({...editingMemory, content: e.target.value})}
                        className="w-full px-3 py-2 bg-surface-1 border border-indigo-500/30 rounded-lg text-white text-sm focus:outline-none resize-none" rows={3} />
                      <div className="flex gap-3">
                        <select value={editingMemory.category} onChange={e => setEditingMemory({...editingMemory, category: e.target.value})}
                          className="px-2 py-1 bg-surface-3 border border-white/[0.08] rounded text-xs text-gray-300 focus:outline-none">
                          {memoryCategories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" value={editingMemory.confidence} min={0} max={1} step={0.1}
                          onChange={e => setEditingMemory({...editingMemory, confidence: parseFloat(e.target.value)})}
                          className="w-20 px-2 py-1 bg-surface-3 border border-white/[0.08] rounded text-xs text-gray-300 focus:outline-none" />
                        <button onClick={handleUpdateMemory} className="px-3 py-1 bg-indigo-500 text-white rounded text-xs">Save</button>
                        <button onClick={() => setEditingMemory(null)} className="px-3 py-1 bg-surface-3 text-gray-400 rounded text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 group">
                      <button onClick={() => setExpandedMemId(expandedMemId === mem.id ? null : mem.id)} className="w-full text-left">
                        <p className="text-sm text-gray-200 leading-relaxed">{mem.content.length > 200 && expandedMemId !== mem.id ? mem.content.slice(0, 200) + "..." : mem.content}</p>
                      </button>
                      <div className="flex items-center gap-3 mt-2.5 text-[11px] text-gray-600">
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{mem.category}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimestamp(mem.created_at)}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{mem.access_count} views</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px]">{(mem.confidence * 100).toFixed(0)}%</span>
                        <span className="text-gray-700">{mem.source}</span>
                        {mem.channel && <span className="text-gray-700">via {mem.channel}</span>}
                        <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingMemory({ id: mem.id, content: mem.content, category: mem.category, confidence: mem.confidence })}
                            className="p-1 text-gray-500 hover:text-indigo-400" title="Correct this memory"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteSemantic(mem.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
