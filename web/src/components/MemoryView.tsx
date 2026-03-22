"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMemories, useMemoryHealth, useMemoryClusters } from "@/lib/hooks";
import { nexusWS, type WSMessage } from "@/lib/websocket";

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
  totalMemories?: number;
  addedThisWeek?: number;
  staleMemories?: number;
}

interface Cluster {
  id?: string;
  label: string;
  count?: number;
  nodes: string[];
  nodeIds?: string[];
  color?: string;
}

interface GraphNode {
  id: string;
  content: string;
  category: string;
  confidence: number;
  usage_count: number;
  cluster?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

export default function MemoryView() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [timelineValue, setTimelineValue] = useState(100);
  const [viewMode, setViewMode] = useState<"grid" | "graph">("graph");
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const simulationRef = useRef<any>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);

  const { data: memories = [], isLoading: loading } = useMemories(debouncedSearch);
  const { data: health } = useMemoryHealth();
  const { data: clusters = [] } = useMemoryClusters();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`${GATEWAY}/api/v1/memories/${id}`, { method: "DELETE" });
      setSelectedMemory(null);
    } catch { /* ignore */ }
  };

  const updateMemory = async (id: string, content: string) => {
    try {
      await fetch(`${GATEWAY}/api/v1/memories/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setEditing(false);
      setSelectedMemory(prev => prev ? { ...prev, content } : null);
    } catch { /* ignore */ }
  };

  const mems: Memory[] = Array.isArray(memories) ? memories : [];

  const filteredMemories = mems.filter(m => {
    if (timelineValue >= 100) return true;
    if (!m.created_at) return true;
    const created = new Date(m.created_at).getTime();
    const now = Date.now();
    const oldest = mems.reduce((min, mem) => {
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

  // Logarithmic node sizing: radius = 8 + Math.log(usageCount + 1) * 6, clamped 8-28
  const nodeRadius = (usageCount: number) => {
    const r = 8 + Math.log((usageCount || 0) + 1) * 6;
    return Math.min(28, Math.max(8, r));
  };

  // Node opacity based on recency (newer = more opaque)
  const nodeOpacity = (created_at?: string) => {
    if (!created_at) return 0.8;
    const age = Date.now() - new Date(created_at).getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    return Math.max(0.3, 1 - (age / maxAge) * 0.7);
  };

  // Category to color mapping
  const categoryColor = (cat?: string) => {
    const colors: Record<string, string> = {
      fact: "#2d8cff", preference: "#a78bfa", goal: "#5ec26a",
      observation: "#ebb95a", task: "#f97316", conversation: "#6ee7b7",
    };
    return colors[cat || "fact"] || "#2d8cff";
  };

  // D3 Force-directed graph rendering
  useEffect(() => {
    if (viewMode !== "graph" || !svgRef.current || filteredMemories.length === 0) return;

    // Dynamic import d3
    import("d3").then((d3) => {
      const svgEl = svgRef.current!;
      const svg = d3.select(svgEl);
      const width = svgEl.clientWidth || 800;
      const height = svgEl.clientHeight || 600;

      svg.selectAll("*").remove();

      // Build nodes with cluster assignment
      const clusterMap = new Map<string, string>();
      clusters.forEach((c: Cluster) => {
        c.nodes.forEach(nid => clusterMap.set(nid, c.label));
      });

      const nodes: GraphNode[] = filteredMemories.map(m => ({
        id: m.id,
        content: m.content,
        category: m.category || "fact",
        confidence: m.confidence || 0.5,
        usage_count: m.access_count || m.usage_count || 0,
        cluster: clusterMap.get(m.id),
      }));
      nodesRef.current = nodes;

      // Build edges from word overlap
      const edges: GraphEdge[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const wordsA = new Set(nodes[i].content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        for (let j = i + 1; j < nodes.length; j++) {
          const wordsB = new Set(nodes[j].content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
          let shared = 0;
          for (const w of wordsA) { if (wordsB.has(w)) shared++; }
          const minSize = Math.min(wordsA.size, wordsB.size);
          if (minSize > 0 && shared / minSize > 0.2) {
            edges.push({ source: nodes[i].id, target: nodes[j].id, weight: shared / minSize });
          }
        }
      }

      const g = svg.append("g");

      // Zoom
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on("zoom", (event) => g.attr("transform", event.transform));
      (svg as any).call(zoom);

      // Links
      const link = g.append("g").selectAll("line")
        .data(edges)
        .join("line")
        .attr("stroke", "rgba(45,140,255,0.12)")
        .attr("stroke-width", (d: any) => Math.max(0.5, (d.weight || 0) * 2));

      // Node groups
      const nodeGroup = g.append("g").selectAll("g")
        .data(nodes)
        .join("g")
        .attr("cursor", "pointer")
        .call(d3.drag<any, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x; d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          }) as any);

      // Main circles with logarithmic sizing
      nodeGroup.append("circle")
        .attr("r", (d: any) => nodeRadius(d.usage_count))
        .attr("fill", (d: any) => categoryColor(d.category))
        .attr("opacity", (d: any) => {
          const mem = filteredMemories.find(m => m.id === d.id);
          return nodeOpacity(mem?.created_at);
        })
        .attr("stroke", "rgba(255,255,255,0.1)")
        .attr("stroke-width", 1)
        .attr("class", "graph-node")
        .attr("data-id", (d: GraphNode) => d.id)
        .attr("data-cluster", (d: GraphNode) => d.cluster || "");

      // Hover tooltip
      const tooltip = d3.select(graphRef.current).append("div")
        .style("position", "absolute")
        .style("display", "none")
        .style("background", "var(--bg-raised)")
        .style("border", "1px solid var(--border-mid)")
        .style("border-radius", "8px")
        .style("padding", "10px 14px")
        .style("font-size", "12px")
        .style("color", "var(--text-1)")
        .style("max-width", "250px")
        .style("pointer-events", "none")
        .style("z-index", "20")
        .style("box-shadow", "0 4px 16px rgba(0,0,0,0.3)");

      nodeGroup
        .on("mouseenter", (event: MouseEvent, d: any) => {
          const mem = filteredMemories.find(m => m.id === d.id);
          tooltip.style("display", "block")
            .html(`<div style="margin-bottom:6px;line-height:1.4">${d.content.slice(0, 120)}${d.content.length > 120 ? '...' : ''}</div>
              <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-3)">
                ${d.category} · ${Math.round(d.confidence * 100)}% · used ${d.usage_count}x
              </div>`);
        })
        .on("mousemove", (event: MouseEvent) => {
          const rect = graphRef.current!.getBoundingClientRect();
          tooltip.style("left", (event.clientX - rect.left + 12) + "px")
            .style("top", (event.clientY - rect.top - 10) + "px");
        })
        .on("mouseleave", () => tooltip.style("display", "none"))
        .on("click", (_event: MouseEvent, d: any) => {
          const mem = filteredMemories.find(m => m.id === d.id);
          if (mem) { setSelectedMemory(mem); setEditing(false); }
        });

      // Cluster labels
      const clusterLabels = g.append("g").selectAll("text")
        .data(clusters.filter((c: Cluster) => c.nodes.length > 1))
        .join("text")
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono)")
        .attr("fill", "var(--text-3)")
        .attr("text-anchor", "middle")
        .attr("pointer-events", "all")
        .attr("cursor", "pointer")
        .text((d: any) => d.label);

      // Cluster hover dimming
      clusterLabels
        .on("mouseenter", (_event: MouseEvent, d: any) => {
          const clusterNodeIds = new Set((d as Cluster).nodes);
          nodeGroup.selectAll("circle.graph-node")
            .transition().duration(150)
            .attr("opacity", (_d: any, _i: number, nodes: ArrayLike<any>) => {
              const el = nodes[_i] as SVGCircleElement;
              const nid = el.getAttribute("data-id");
              return clusterNodeIds.has(nid || "") ? 1.0 : 0.2;
            });
          link.transition().duration(150)
            .attr("stroke-opacity", 0.05);
        })
        .on("mouseleave", () => {
          nodeGroup.selectAll("circle.graph-node")
            .transition().duration(150)
            .attr("opacity", (_d: any, _i: number, nodes: ArrayLike<any>) => {
              const el = nodes[_i] as SVGCircleElement;
              const nid = el.getAttribute("data-id");
              const mem = filteredMemories.find(m => m.id === nid);
              return nodeOpacity(mem?.created_at);
            });
          link.transition().duration(150)
            .attr("stroke-opacity", 1);
        });

      // Force simulation
      const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
        .force("link", d3.forceLink(edges).id((d: any) => d.id).distance(80).strength(0.3))
        .force("charge", d3.forceManyBody().strength(-120))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius((d: any) => nodeRadius(d.usage_count) + 4))
        .on("tick", () => {
          link
            .attr("x1", (d: any) => d.source.x)
            .attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x)
            .attr("y2", (d: any) => d.target.y);
          nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
          // Update cluster label positions (centroid of cluster nodes)
          clusterLabels.attr("x", (c: any) => {
            const cnodes = nodes.filter(n => (c as Cluster).nodes.includes(n.id));
            return cnodes.length ? cnodes.reduce((s, n) => s + (n.x || 0), 0) / cnodes.length : 0;
          }).attr("y", (c: any) => {
            const cnodes = nodes.filter(n => (c as Cluster).nodes.includes(n.id));
            return cnodes.length ? cnodes.reduce((s, n) => s + (n.y || 0), 0) / cnodes.length - 30 : 0;
          });
        });

      simulationRef.current = simulation;

      return () => {
        simulation.stop();
        tooltip.remove();
      };
    });
  }, [viewMode, filteredMemories, clusters]);

  // Memory pulse ripple handler
  useEffect(() => {
    const unsub = nexusWS.on("memory-pulse", (msg: WSMessage) => {
      const payload = msg.payload as { memoryIds?: string[]; memoryId?: string };
      const ids = payload.memoryIds || (payload.memoryId ? [payload.memoryId] : []);
      if (!svgRef.current || viewMode !== "graph") return;

      // Find the SVG circles and add ripple animations
      for (const id of ids) {
        const circle = svgRef.current.querySelector(`circle[data-id="${id}"]`);
        if (!circle) continue;
        const parent = circle.parentElement;
        if (!parent) continue;
        const r = parseFloat(circle.getAttribute("r") || "10");
        const color = circle.getAttribute("fill") || "#2d8cff";

        // Create ripple circle
        const ripple = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ripple.setAttribute("r", String(r));
        ripple.setAttribute("fill", "none");
        ripple.setAttribute("stroke", color);
        ripple.setAttribute("stroke-width", "2");
        ripple.setAttribute("opacity", "0.6");

        // Animate: expand to 2.5x radius, fade out over 800ms
        const animateR = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        animateR.setAttribute("attributeName", "r");
        animateR.setAttribute("from", String(r));
        animateR.setAttribute("to", String(r * 2.5));
        animateR.setAttribute("dur", "0.8s");
        animateR.setAttribute("fill", "freeze");

        const animateOpacity = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        animateOpacity.setAttribute("attributeName", "opacity");
        animateOpacity.setAttribute("from", "0.6");
        animateOpacity.setAttribute("to", "0");
        animateOpacity.setAttribute("dur", "0.8s");
        animateOpacity.setAttribute("fill", "freeze");

        ripple.appendChild(animateR);
        ripple.appendChild(animateOpacity);
        parent.insertBefore(ripple, circle);

        // Remove ripple after animation
        setTimeout(() => ripple.remove(), 850);
      }
    });
    return () => unsub();
  }, [viewMode]);

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
        {/* View mode toggle */}
        <div style={{ display: "flex", gap: 2, background: "var(--bg-raised)", borderRadius: "var(--r-sm)", padding: 2 }}>
          <button onClick={() => setViewMode("graph")}
            style={{ padding: "4px 10px", fontSize: 10, fontFamily: "var(--font-mono)", borderRadius: 4, border: "none", cursor: "pointer",
              background: viewMode === "graph" ? "var(--accent)" : "transparent", color: viewMode === "graph" ? "white" : "var(--text-3)" }}>
            Graph
          </button>
          <button onClick={() => setViewMode("grid")}
            style={{ padding: "4px 10px", fontSize: 10, fontFamily: "var(--font-mono)", borderRadius: 4, border: "none", cursor: "pointer",
              background: viewMode === "grid" ? "var(--accent)" : "transparent", color: viewMode === "grid" ? "white" : "var(--text-3)" }}>
            Grid
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
          {filteredMemories.length} memories
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Main area */}
        <div ref={graphRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Search bar */}
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
                value={search} onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search memories by concept..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-ui)" }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setDebouncedSearch(""); }} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14 }}>&times;</button>
              )}
            </div>
          </div>

          {/* Graph view */}
          {viewMode === "graph" && (
            <svg ref={svgRef} style={{ width: "100%", height: "100%", background: "var(--bg-base)" }} />
          )}

          {/* Grid view */}
          {viewMode === "grid" && (
            <div style={{ width: "100%", height: "100%", padding: "70px 16px 60px", overflowY: "auto" }}>
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
                        {mem.usage_count !== undefined && mem.usage_count > 0 && (
                          <span>used {mem.usage_count}x</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  { label: "Total", value: health.total_memories ?? health.totalMemories ?? 0 },
                  { label: "This week", value: "+" + (health.memories_this_week ?? health.addedThisWeek ?? 0) },
                  { label: "Stale", value: health.stale_count ?? health.staleMemories ?? 0 },
                  { label: "Clusters", value: health.cluster_count || clusters.length || 0 },
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
              {clusters.map((c: Cluster, i: number) => (
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
                    {selectedMemory.usage_count !== undefined && <div style={{ color: "var(--text-3)" }}>Used: <span style={{ color: "var(--text-2)" }}>{selectedMemory.usage_count} times</span></div>}
                    {selectedMemory.source && <div style={{ color: "var(--text-3)" }}>Source: <span style={{ color: "var(--text-2)" }}>{selectedMemory.source}</span></div>}
                    {selectedMemory.created_at && <div style={{ color: "var(--text-3)" }}>Created: <span style={{ color: "var(--text-2)" }}>{new Date(selectedMemory.created_at).toLocaleDateString()}</span></div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => { setEditing(true); setEditContent(selectedMemory.content); }}
                      style={{ flex: 1, padding: "6px 12px", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>
                      Correct this memory
                    </button>
                    <button onClick={() => deleteMemory(selectedMemory.id)}
                      style={{ padding: "6px 12px", background: "rgba(235,100,90,0.08)", color: "#eb645a", border: "1px solid rgba(235,100,90,0.15)", borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 16, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>Select a memory to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
