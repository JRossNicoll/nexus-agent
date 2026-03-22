#!/usr/bin/env python3
"""Write the new MemoryView.tsx with D3 force-directed graph."""
import pathlib

content = r'''"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, Trash2, Edit3, Save, X, Database, Brain, Network,
  Clock, Activity,
} from "lucide-react";
import * as d3 from "d3";
import {
  memoryAPI, structuredAPI,
  type SemanticMemory, type StructuredMemory,
  type MemoryGraphDataWithClusters, type MemoryGraphNode, type MemoryCluster, type MemoryHealth,
} from "@/lib/api";
import { cn, formatTimestamp } from "@/lib/utils";
import { medoWS } from "@/lib/websocket";

type MemoryTab = "graph" | "structured" | "semantic";

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  content: string;
  category: string;
  confidence: number;
  source: string;
  created_at: number;
  last_accessed: number;
  access_count: number;
  channel?: string;
  conversation_id?: string;
  tags?: string[];
  radius: number;
  clusterId?: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

interface EditingMemory {
  id: string;
  content: string;
  category: string;
  confidence: number;
}

const CAT_COLORS: Record<string, string> = {
  fact: "#6366f1",
  preference: "#8b5cf6",
  event: "#ec4899",
  document: "#06b6d4",
  insight: "#f59e0b",
  default: "#64748b",
};

export default function MemoryView() {
  const [activeTab, setActiveTab] = useState<MemoryTab>("graph");
  const [structured, setStructured] = useState<StructuredMemory[]>([]);
  const [semantic, setSemantic] = useState<SemanticMemory[]>([]);
  const [graphData, setGraphData] = useState<MemoryGraphDataWithClusters | null>(null);
  const [health, setHealth] = useState<MemoryHealth | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHighlight, setSearchHighlight] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ key: "", value: "", category: "preferences", type: "string" });
  const [editingMemory, setEditingMemory] = useState<EditingMemory | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [expandedMemId, setExpandedMemId] = useState<string | null>(null);
  const [timelineValue, setTimelineValue] = useState(100);
  const [timeRange, setTimeRange] = useState<{ min: number; max: number }>({ min: 0, max: Date.now() });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<MemoryGraphNode | null>(null);
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  /* Listen for memory-pulse WebSocket events */
  useEffect(() => {
    const unsub = medoWS.on("memory-pulse", (msg) => {
      const payload = msg.payload as { memoryIds?: string[]; memoryId?: string };
      const ids = payload.memoryIds ?? (payload.memoryId ? [payload.memoryId] : []);
      if (ids.length > 0) {
        setPulsingIds(new Set(ids));
        setTimeout(() => setPulsingIds(new Set()), 2000);
      }
    });
    return unsub;
  }, []);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "structured") {
        setStructured(await structuredAPI.getAll());
      } else if (activeTab === "semantic") {
        setSemantic(await memoryAPI.getMemories({ limit: 200, category: filterCategory || undefined }));
      } else if (activeTab === "graph") {
        const [gd, h] = await Promise.all([
          memoryAPI.getGraph({ cluster: "true" }),
          memoryAPI.getHealth(),
        ]);
        setGraphData(gd);
        setHealth(h);
        if (gd.nodes.length > 0) {
          const ts = gd.nodes.map(n => n.created_at);
          setTimeRange({ min: Math.min(...ts), max: Math.max(...ts) });
        }
      }
    } catch (err) { console.error("Failed to load:", err); }
    setLoading(false);
  };

  /* ---- D3 Force-Directed Graph ---- */
  const renderGraph = useCallback(() => {
    if (!svgRef.current || !graphData || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    svg.attr("width", width).attr("height", height)
       .attr("viewBox", "0 0 " + width + " " + height);
    if (graphData.nodes.length === 0) return;

    // Timeline filtering
    const cutoffTime = timeRange.min + (timeRange.max - timeRange.min) * (timelineValue / 100);
    const visibleNodes = graphData.nodes.filter(n => n.created_at <= cutoffTime);
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = graphData.edges.filter(
      e => visibleIds.has(e.source as string) && visibleIds.has(e.target as string)
    );

    // Build cluster map
    const nodeClusterMap = new Map<string, string>();
    if (graphData.clusters) {
      for (const c of graphData.clusters) {
        for (const nid of c.nodeIds) nodeClusterMap.set(nid, c.id);
      }
    }

    const now = Date.now();
    const simNodes: SimNode[] = visibleNodes.map(n => ({
      ...n,
      last_accessed: (n as unknown as Record<string, number>).last_accessed || n.created_at,
      radius: 5 + Math.min(n.confidence * 10, 15) + Math.min(n.access_count * 0.5, 5),
      clusterId: nodeClusterMap.get(n.id),
    }));
    const simLinks: SimLink[] = visibleEdges.map(e => ({
      source: e.source, target: e.target, weight: e.weight,
    }));

    // Root group with zoom
    const g = svg.append("g");
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoomBehavior);

    // Layer groups
    const hullGroup = g.append("g").attr("class", "hulls");
    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");

    // Draw edges
    const linkEls = linkGroup.selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks).join("line")
      .attr("stroke", "#6366f1")
      .attr("stroke-opacity", (d: SimLink) => Math.min(d.weight * 0.3, 0.4))
      .attr("stroke-width", (d: SimLink) => Math.max(d.weight * 2, 0.5));

    // Draw node groups
    const nodeEls = nodeGroup.selectAll<SVGGElement, SimNode>("g")
      .data(simNodes, (d: SimNode) => d.id).join("g").attr("cursor", "pointer");

    // Drag behavior
    const dragBehavior = d3.drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    nodeEls.call(dragBehavior);

    // Node circles - size=confidence, opacity=recency
    nodeEls.append("circle")
      .attr("r", (d: SimNode) => d.radius)
      .attr("fill", (d: SimNode) => CAT_COLORS[d.category] ?? CAT_COLORS.default)
      .attr("fill-opacity", (d: SimNode) => Math.max(0.3, 1 - (now - d.created_at) / (90 * 24 * 3600000)))
      .attr("stroke", (d: SimNode) =>
        pulsingIds.has(d.id) ? "#fff"
        : searchHighlight.has(d.id) ? "#f59e0b"
        : (CAT_COLORS[d.category] ?? CAT_COLORS.default))
      .attr("stroke-width", (d: SimNode) => pulsingIds.has(d.id) ? 3 : searchHighlight.has(d.id) ? 2.5 : 1.5)
      .attr("stroke-opacity", 0.8);

    // Pulse animation rings
    nodeEls.filter((d: SimNode) => pulsingIds.has(d.id)).append("circle")
      .attr("r", (d: SimNode) => d.radius)
      .attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 2).attr("opacity", 1)
      .transition().duration(1200).ease(d3.easeExpOut)
      .attr("r", (d: SimNode) => d.radius + 20).attr("opacity", 0).remove();

    // Search highlight rings
    nodeEls.filter((d: SimNode) => searchHighlight.has(d.id)).append("circle")
      .attr("r", (d: SimNode) => d.radius + 4)
      .attr("fill", "none").attr("stroke", "#f59e0b")
      .attr("stroke-width", 1.5).attr("stroke-opacity", 0.5).attr("stroke-dasharray", "3,2");

    // Labels for larger nodes
    nodeEls.filter((d: SimNode) => d.radius > 8).append("text")
      .attr("dx", (d: SimNode) => d.radius + 5).attr("dy", 4)
      .attr("font-size", "10px").attr("fill", "#94a3b8").attr("pointer-events", "none")
      .text((d: SimNode) => d.content.length > 35 ? d.content.slice(0, 35) + "..." : d.content);

    // Hover and click interactions
    nodeEls
      .on("mouseenter", function(_ev: MouseEvent, d: SimNode) {
        setHoveredNode(d);
        d3.select(this).select("circle").transition().duration(150)
          .attr("stroke-width", 3).attr("stroke-opacity", 1);
      })
      .on("mouseleave", function(_ev: MouseEvent, d: SimNode) {
        setHoveredNode(null);
        d3.select(this).select("circle").transition().duration(150)
          .attr("stroke-width", pulsingIds.has(d.id) ? 3 : searchHighlight.has(d.id) ? 2.5 : 1.5)
          .attr("stroke-opacity", 0.8);
      })
      .on("click", function(_ev: MouseEvent, d: SimNode) {
        setSelectedNode(prev => prev?.id === d.id ? null : d);
      });

    // Force simulation
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d: SimNode) => d.id).distance(80).strength((d: SimLink) => d.weight * 0.3))
      .force("charge", d3.forceManyBody<SimNode>().strength(-120).distanceMax(300))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force("collision", d3.forceCollide<SimNode>().radius((d: SimNode) => d.radius + 3))
      .force("x", d3.forceX(width / 2).strength(0.02))
      .force("y", d3.forceY(height / 2).strength(0.02));
    simulationRef.current = simulation;

    // Cluster attraction force
    if (graphData.clusters && graphData.clusters.length > 0) {
      simulation.force("cluster", () => {
        for (const cluster of graphData.clusters ?? []) {
          const cNodes = simNodes.filter(n => cluster.nodeIds.includes(n.id));
          if (cNodes.length < 2) continue;
          const cx = cNodes.reduce((s, n) => s + (n.x ?? 0), 0) / cNodes.length;
          const cy = cNodes.reduce((s, n) => s + (n.y ?? 0), 0) / cNodes.length;
          for (const n of cNodes) {
            n.vx = (n.vx ?? 0) + (cx - (n.x ?? 0)) * 0.005;
            n.vy = (n.vy ?? 0) + (cy - (n.y ?? 0)) * 0.005;
          }
        }
      });
    }

    // Hull drawing function for clusters
    const updateHulls = () => {
      hullGroup.selectAll("*").remove();
      for (const cluster of graphData.clusters ?? []) {
        const cNodes = simNodes.filter(n => cluster.nodeIds.includes(n.id));
        if (cNodes.length < 3) continue;
        const points: [number, number][] = cNodes.map(n => [n.x ?? 0, n.y ?? 0]);
        const hull = d3.polygonHull(points);
        if (!hull) continue;
        const centroid = d3.polygonCentroid(hull);
        const expanded = hull.map(([x, y]): [number, number] => {
          const dx = x - centroid[0]; const dy = y - centroid[1];
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return [x + dx / dist * 25, y + dy / dist * 25];
        });
        hullGroup.append("path")
          .attr("d", "M" + expanded.map(p => p.join(",")).join("L") + "Z")
          .attr("fill", cluster.color).attr("fill-opacity", 0.06)
          .attr("stroke", cluster.color).attr("stroke-opacity", 0.15).attr("stroke-width", 1);
        hullGroup.append("text")
          .attr("x", centroid[0]).attr("y", centroid[1] - 30)
          .attr("text-anchor", "middle").attr("fill", cluster.color).attr("fill-opacity", 0.6)
          .attr("font-size", "11px").attr("font-weight", "600").text(cluster.label);
      }
    };

    // Tick handler
    simulation.on("tick", () => {
      linkEls
        .attr("x1", (d: SimLink) => ((d.source as SimNode).x ?? 0))
        .attr("y1", (d: SimLink) => ((d.source as SimNode).y ?? 0))
        .attr("x2", (d: SimLink) => ((d.target as SimNode).x ?? 0))
        .attr("y2", (d: SimLink) => ((d.target as SimNode).y ?? 0));
      nodeEls.attr("transform", (d: SimNode) => "translate(" + (d.x ?? 0) + "," + (d.y ?? 0) + ")");
      updateHulls();
    });

    return () => { simulation.stop(); };
  }, [graphData, timelineValue, timeRange, searchHighlight, pulsingIds]);

  useEffect(() => {
    if (activeTab === "graph") {
      const cleanup = renderGraph();
      return () => { if (cleanup) cleanup(); };
    }
  }, [activeTab, renderGraph]);

  const handleTimelineChange = (value: number) => { setTimelineValue(value); };

  const handleGraphSearch = async () => {
    if (!searchQuery.trim()) { setSearchHighlight(new Set()); return; }
    try {
      const r = await memoryAPI.searchMemories(searchQuery, 20);
      setSearchHighlight(new Set(r.map(m => m.id)));
    } catch { setSearchHighlight(new Set()); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadData(); return; }
    setLoading(true);
    try { setSemantic(await memoryAPI.searchMemories(searchQuery)); }
    catch (err) { console.error("Search failed:", err); }
    setLoading(false);
  };

  const handleSaveStructured = async (key: string) => {
    try { await structuredAPI.set(key, { value: editValue }); setEditingKey(null); loadData(); }
    catch (err) { console.error(err); }
  };
  const handleDeleteStructured = async (key: string) => {
    try { await structuredAPI.delete(key); loadData(); } catch (err) { console.error(err); }
  };
  const handleDeleteSemantic = async (id: string) => {
    try {
      await memoryAPI.deleteMemory(id);
      setSemantic(prev => prev.filter(m => m.id !== id));
      if (selectedNode?.id === id) setSelectedNode(null);
    } catch (err) { console.error(err); }
  };
  const handleUpdateMemory = async () => {
    if (!editingMemory) return;
    try {
      await memoryAPI.updateMemory(editingMemory.id, {
        content: editingMemory.content,
        category: editingMemory.category,
        confidence: editingMemory.confidence,
      });
      setEditingMemory(null); setSelectedNode(null); loadData();
    } catch (err) { console.error(err); }
  };
  const handleAddStructured = async () => {
    if (!newEntry.key || !newEntry.value) return;
    try {
      await structuredAPI.set(newEntry.key, {
        value: newEntry.value, type: newEntry.type, category: newEntry.category,
      });
      setShowAddForm(false);
      setNewEntry({ key: "", value: "", category: "preferences", type: "string" });
      loadData();
    } catch (err) { console.error(err); }
  };
  const handleConsolidate = async () => {
    try {
      const r = await memoryAPI.consolidate();
      alert("Consolidation: " + r.merged + " merged, " + r.flagged + " flagged");
      loadData();
    } catch (err) { console.error(err); }
  };

  const categories = [...new Set(structured.map(s => s.category))].sort();
  const groupedStructured = categories.reduce((acc, cat) => {
    acc[cat] = structured.filter(s => s.category === cat); return acc;
  }, {} as Record<string, StructuredMemory[]>);
  const memoryCategories = ["", "fact", "preference", "event", "document", "insight"];

  const formatDate = (ts: number) => {
    if (!ts) return "\u2014";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const formatTimeAgo = (ts: number) => {
    if (!ts) return "\u2014";
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + "d ago";
    return Math.floor(days / 30) + "mo ago";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white">Memory</h1>
          <div className="flex bg-surface-2/80 rounded-lg p-0.5 border border-white/[0.04]">
            {([
              { id: "graph" as MemoryTab, label: "Graph", icon: Network },
              { id: "structured" as MemoryTab, label: "Structured", icon: Database },
              { id: "semantic" as MemoryTab, label: "Semantic", icon: Brain },
            ]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200",
                  activeTab === t.id ? "bg-indigo-500/15 text-indigo-300 shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
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
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
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

      {/* Graph search bar */}
      {activeTab === "graph" && (
        <div className="px-6 py-2 border-b border-white/[0.06] flex gap-2 items-center">
          <Search className="w-3.5 h-3.5 text-gray-600" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleGraphSearch(); }}
            placeholder="Search memories - matching nodes highlight"
            className="flex-1 px-3 py-1.5 bg-surface-2 border border-white/[0.08] rounded-lg text-white placeholder-gray-600 text-xs focus:outline-none focus:border-indigo-500/40" />
          <button onClick={handleGraphSearch}
            className="px-3 py-1.5 bg-indigo-500/15 text-indigo-300 rounded-lg text-xs hover:bg-indigo-500/25">
            Search
          </button>
          {searchHighlight.size > 0 && (
            <button onClick={() => { setSearchHighlight(new Set()); setSearchQuery(""); }}
              className="px-2 py-1.5 text-gray-500 text-xs hover:text-gray-300">Clear</button>
          )}
        </div>
      )}

      {/* Semantic search bar */}
      {activeTab === "semantic" && (
        <div className="px-6 py-2.5 border-b border-white/[0.06]">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
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

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mr-3" />
            Loading...
          </div>
        ) : activeTab === "graph" ? (
          /* ===== GRAPH VIEW ===== */
          <div className="h-full flex">
            {/* SVG container */}
            <div ref={containerRef} className="flex-1 relative bg-[#0a0a14]">
              {graphData && graphData.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-600">
                  <Network className="w-12 h-12 mb-3 opacity-40" />
                  <p>No memory graph data yet</p>
                  <p className="text-xs mt-1">Have conversations to build your memory graph</p>
                </div>
              ) : (
                <>
                  <svg ref={svgRef} className="w-full h-full" />
                  {/* Legend */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2 bg-surface-1/80 backdrop-blur rounded-lg px-3 py-2 border border-white/[0.06]">
                    {Object.entries(CAT_COLORS).filter(([k]) => k !== "default").map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v }} />{k}
                      </div>
                    ))}
                  </div>
                  {/* Hover tooltip */}
                  {hoveredNode && !selectedNode && (
                    <div className="absolute top-3 right-[calc(18rem+12px)] w-64 bg-surface-2/95 backdrop-blur border border-white/[0.08] rounded-xl p-3 shadow-xl pointer-events-none animate-fade-in z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CAT_COLORS[hoveredNode.category] ?? CAT_COLORS.default }} />
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{hoveredNode.category}</span>
                        <span className="text-[10px] text-gray-600 ml-auto">{formatTimeAgo(hoveredNode.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{hoveredNode.content.slice(0, 200)}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                        <span>Conf: {(hoveredNode.confidence * 100).toFixed(0)}%</span>
                        <span>Used: {hoveredNode.access_count}x</span>
                        <span>{hoveredNode.source}</span>
                      </div>
                    </div>
                  )}
                  {/* Timeline scrubber */}
                  <div className="absolute bottom-0 left-0 right-0 bg-surface-1/90 backdrop-blur border-t border-white/[0.06] px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="text-[10px] text-gray-500 w-20">{formatDate(timeRange.min)}</span>
                      <input type="range" min={0} max={100} value={timelineValue}
                        onChange={e => handleTimelineChange(Number(e.target.value))}
                        className="flex-1 h-1 bg-surface-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/30" />
                      <span className="text-[10px] text-gray-500 w-20 text-right">
                        {timelineValue === 100 ? "Now" : formatDate(timeRange.min + (timeRange.max - timeRange.min) * (timelineValue / 100))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Right panel: selected node detail OR health dashboard */}
            <div className="w-72 border-l border-white/[0.06] bg-surface-1/50 overflow-y-auto flex-shrink-0">
              {selectedNode ? (
                <div className="p-4 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-white">Memory Detail</h3>
                    <button onClick={() => setSelectedNode(null)} className="text-gray-600 hover:text-gray-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CAT_COLORS[selectedNode.category] ?? CAT_COLORS.default }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: CAT_COLORS[selectedNode.category] ?? CAT_COLORS.default }}>
                      {selectedNode.category}
                    </span>
                  </div>
                  {editingMemory?.id === selectedNode.id ? (
                    <div className="space-y-2 mb-3">
                      <textarea value={editingMemory.content}
                        onChange={e => setEditingMemory({ ...editingMemory, content: e.target.value })}
                        className="w-full h-24 px-2 py-1.5 bg-surface-3 border border-white/[0.08] rounded-lg text-gray-200 text-xs resize-none focus:outline-none focus:border-indigo-500/40" />
                      <select value={editingMemory.category}
                        onChange={e => setEditingMemory({ ...editingMemory, category: e.target.value })}
                        className="w-full px-2 py-1 bg-surface-3 border border-white/[0.08] rounded-lg text-gray-300 text-xs focus:outline-none">
                        {memoryCategories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleUpdateMemory}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500 text-white rounded-lg text-[10px]">
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button onClick={() => setEditingMemory(null)}
                          className="px-2.5 py-1 bg-surface-3 text-gray-400 rounded-lg text-[10px]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300 leading-relaxed mb-3">{selectedNode.content}</p>
                  )}
                  {/* Provenance section */}
                  <div className="space-y-2 mb-3">
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Provenance</h4>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created</span>
                        <span className="text-gray-400">{formatDate(selectedNode.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Source</span>
                        <span className="text-gray-400">{selectedNode.source}</span>
                      </div>
                      {selectedNode.channel && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Channel</span>
                          <span className="text-gray-400">{selectedNode.channel}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Confidence</span>
                        <span className="text-gray-400">{(selectedNode.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Times Used</span>
                        <span className="text-gray-400">{selectedNode.access_count}</span>
                      </div>
                      {selectedNode.conversation_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Conv</span>
                          <span className="text-gray-400 font-mono text-[10px]">
                            {selectedNode.conversation_id.slice(0, 12)}...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button onClick={() => setEditingMemory({
                      id: selectedNode.id, content: selectedNode.content,
                      category: selectedNode.category, confidence: selectedNode.confidence,
                    })}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/15 text-indigo-300 rounded-lg text-[10px] hover:bg-indigo-500/25 transition-colors">
                      <Edit3 className="w-3 h-3" /> Correct
                    </button>
                    <button onClick={() => handleDeleteSemantic(selectedNode.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/15 text-red-300 rounded-lg text-[10px] hover:bg-red-500/25 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ) : (
                /* Health dashboard */
                <div className="p-4">
                  <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />Memory Health
                  </h3>
                  {health ? (
                    <div className="space-y-3">
                      <div className="bg-surface-2 rounded-lg p-3 border border-white/[0.04]">
                        <div className="text-2xl font-bold text-white">{health.totalMemories}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Memories</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface-2 rounded-lg p-2.5 border border-white/[0.04]">
                          <div className="text-sm font-semibold text-emerald-400">+{health.addedThisWeek}</div>
                          <div className="text-[10px] text-gray-600">This Week</div>
                        </div>
                        <div className="bg-surface-2 rounded-lg p-2.5 border border-white/[0.04]">
                          <div className="text-sm font-semibold text-amber-400">{health.staleMemories}</div>
                          <div className="text-[10px] text-gray-600">{"Stale (>30d)"}</div>
                        </div>
                      </div>
                      {health.oldestMemory && (
                        <div className="bg-surface-2 rounded-lg p-2.5 border border-white/[0.04]">
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Oldest Memory</div>
                          <div className="text-xs text-gray-300">{formatDate(health.oldestMemory)}</div>
                        </div>
                      )}
                      {health.mostReferenced && (
                        <div className="bg-surface-2 rounded-lg p-2.5 border border-white/[0.04]">
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Most Referenced</div>
                          <div className="text-xs text-gray-300 line-clamp-2">{health.mostReferenced.content.slice(0, 80)}</div>
                          <div className="text-[10px] text-indigo-400 mt-1">Used {health.mostReferenced.access_count}x</div>
                        </div>
                      )}
                      <div className="bg-surface-2 rounded-lg p-2.5 border border-white/[0.04]">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Conversations</div>
                        <div className="text-sm font-semibold text-gray-300">{health.totalConversations}</div>
                      </div>
                      {graphData?.clusters && graphData.clusters.length > 0 && (
                        <div className="bg-surface-2 rounded-lg p-2.5 border border-white/[0.04]">
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Clusters</div>
                          <div className="space-y-1.5">
                            {graphData.clusters.map(c => (
                              <div key={c.id} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                <span className="text-xs text-gray-300">{c.label}</span>
                                <span className="text-[10px] text-gray-600 ml-auto">{c.nodeIds.length}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : <div className="text-xs text-gray-600">Loading health data...</div>}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "structured" ? (
          /* ===== STRUCTURED VIEW ===== */
          <div className="overflow-y-auto px-6 py-4 space-y-6">
            {showAddForm && (
              <div className="bg-surface-2 rounded-xl p-4 border border-indigo-500/20 animate-fade-in">
                <h3 className="text-xs font-semibold text-white mb-3">Add Memory Entry</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={newEntry.key}
                    onChange={e => setNewEntry(p => ({ ...p, key: e.target.value }))}
                    placeholder="Key"
                    className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  <input type="text" value={newEntry.value}
                    onChange={e => setNewEntry(p => ({ ...p, value: e.target.value }))}
                    placeholder="Value"
                    className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  <select value={newEntry.category}
                    onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
                    className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none">
                    <option value="identity">Identity</option><option value="preferences">Preferences</option>
                    <option value="health">Health</option><option value="finance">Finance</option>
                    <option value="relationships">Relationships</option><option value="goals">Goals</option>
                  </select>
                  <select value={newEntry.type}
                    onChange={e => setNewEntry(p => ({ ...p, type: e.target.value }))}
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
            {categories.length === 0 && !showAddForm ? (
              <div className="text-center text-gray-600 py-12">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No structured memories</p>
                <p className="text-xs mt-1 text-gray-700">Add key-value facts the agent should remember</p>
              </div>
            ) : (
              Object.entries(groupedStructured).map(([category, entries]) => (
                <div key={category}>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {category} <span className="text-gray-700">({entries.length})</span>
                  </h3>
                  <div className="space-y-1">
                    {entries.map(entry => (
                      <div key={entry.key}
                        className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition-colors group">
                        <span className="text-xs text-indigo-300 font-mono flex-shrink-0 w-32 truncate">{entry.key}</span>
                        {editingKey === entry.key ? (
                          <div className="flex-1 flex gap-2">
                            <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                              className="flex-1 px-2 py-1 bg-surface-3 border border-white/[0.08] rounded text-white text-xs focus:outline-none focus:border-indigo-500/40" />
                            <button onClick={() => handleSaveStructured(entry.key)} className="text-indigo-400 hover:text-indigo-300">
                              <Save className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingKey(null)} className="text-gray-600 hover:text-gray-400">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-gray-300 truncate">{entry.value}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingKey(entry.key); setEditValue(entry.value); }}
                                className="text-gray-600 hover:text-indigo-400"><Edit3 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteStructured(entry.key)}
                                className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
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
          /* ===== SEMANTIC VIEW ===== */
          <div className="overflow-y-auto px-6 py-4 space-y-2">
            {semantic.length === 0 ? (
              <div className="text-center text-gray-600 py-12">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No semantic memories</p>
                <p className="text-xs mt-1 text-gray-700">Memories are created from conversations</p>
              </div>
            ) : (
              semantic.map(mem => (
                <div key={mem.id}
                  className={cn("bg-surface-2 rounded-lg border transition-all",
                    expandedMemId === mem.id ? "border-indigo-500/20" : "border-white/[0.04] hover:border-white/[0.08]")}>
                  <div className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => setExpandedMemId(expandedMemId === mem.id ? null : mem.id)}>
                    <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: CAT_COLORS[mem.category] ?? CAT_COLORS.default, opacity: mem.confidence }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{mem.content}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-600">
                        <span>{mem.category}</span>
                        <span>{formatTimeAgo(mem.created_at)}</span>
                        <span>conf: {(mem.confidence * 100).toFixed(0)}%</span>
                        <span>used: {mem.access_count}x</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={e => {
                        e.stopPropagation();
                        setEditingMemory({ id: mem.id, content: mem.content, category: mem.category, confidence: mem.confidence });
                      }} className="text-gray-700 hover:text-indigo-400 transition-colors p-1">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteSemantic(mem.id); }}
                        className="text-gray-700 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {expandedMemId === mem.id && (
                    <div className="px-3 pb-3 pt-0 border-t border-white/[0.04] animate-fade-in">
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                        <div className="text-gray-600">Source: <span className="text-gray-400">{mem.source}</span></div>
                        <div className="text-gray-600">Channel: <span className="text-gray-400">{mem.channel ?? "\u2014"}</span></div>
                        <div className="text-gray-600">Created: <span className="text-gray-400">{formatDate(mem.created_at)}</span></div>
                        <div className="text-gray-600">Last accessed: <span className="text-gray-400">{formatDate(mem.last_accessed)}</span></div>
                        {mem.conversation_id && (
                          <div className="text-gray-600 col-span-2">
                            Conv: <span className="text-gray-400 font-mono">{mem.conversation_id}</span>
                          </div>
                        )}
                        {mem.tags && mem.tags.length > 0 && (
                          <div className="text-gray-600 col-span-2">
                            Tags: {mem.tags.map(t => (
                              <span key={t} className="inline-block px-1.5 py-0.5 bg-surface-3 rounded text-gray-400 mr-1">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit memory modal (non-graph) */}
      {editingMemory && activeTab !== "graph" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-2 rounded-xl p-5 border border-white/[0.08] w-96 shadow-2xl animate-fade-in">
            <h3 className="text-sm font-semibold text-white mb-3">Edit Memory</h3>
            <textarea value={editingMemory.content}
              onChange={e => setEditingMemory({ ...editingMemory, content: e.target.value })}
              className="w-full h-32 px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-gray-200 text-sm resize-none focus:outline-none focus:border-indigo-500/40 mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select value={editingMemory.category}
                onChange={e => setEditingMemory({ ...editingMemory, category: e.target.value })}
                className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none">
                {memoryCategories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" min={0} max={1} step={0.1} value={editingMemory.confidence}
                onChange={e => setEditingMemory({ ...editingMemory, confidence: Number(e.target.value) })}
                className="px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpdateMemory} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm">Save</button>
              <button onClick={() => setEditingMemory(null)} className="px-4 py-2 bg-surface-3 text-gray-400 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''

target = pathlib.Path("/home/ubuntu/nexus-agent/web/src/components/MemoryView.tsx")
target.write_text(content)
print(f"Written {len(content)} bytes to {target}")
