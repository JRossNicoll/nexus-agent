"use client";

import { useState, useEffect } from "react";
import {
  Zap, Plus, Trash2, Clock, Tag, ToggleLeft, ToggleRight, Save, X, Play, Code,
} from "lucide-react";
import { skillsAPI, type SkillInfo } from "@/lib/api";
import { cn, formatTimestamp } from "@/lib/utils";

type CreateStep = "info" | "trigger" | "code";

export default function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>("info");
  const [editorContent, setEditorContent] = useState("");
  const [editorName, setEditorName] = useState("");

  // Create flow state
  const [newSkill, setNewSkill] = useState({
    name: "", description: "", triggerType: "keyword" as "keyword" | "cron" | "manual",
    triggerValue: "", tools: "" as string, body: "Describe what this skill does and how the agent should behave.",
  });

  useEffect(() => { loadSkills(); }, []);

  const loadSkills = async () => {
    setLoading(true);
    try { const data = await skillsAPI.getAll(); setSkills(data); }
    catch (err) { console.error("Failed to load skills:", err); }
    setLoading(false);
  };

  const handleToggle = async (name: string, currentEnabled: boolean) => {
    try {
      await skillsAPI.toggle(name, !currentEnabled);
      setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled: !currentEnabled } : s));
    } catch (err) { console.error("Toggle failed:", err); }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete skill "${name}"?`)) return;
    try { await skillsAPI.delete(name); setSkills(prev => prev.filter(s => s.name !== name)); }
    catch (err) { console.error("Delete failed:", err); }
  };

  const handleSaveEdit = async () => {
    try {
      await skillsAPI.update(editorName, editorContent);
      setShowEditor(false);
      loadSkills();
    } catch (err) { console.error("Save failed:", err); }
  };

  const handleCreate = async () => {
    if (!newSkill.name) return;
    const triggerLine = newSkill.triggerType === "cron"
      ? `  - cron: "${newSkill.triggerValue}"`
      : newSkill.triggerType === "keyword"
      ? `  - keyword: "${newSkill.triggerValue}"`
      : "  # manual trigger";
    const content = `---\nname: ${newSkill.name}\ndescription: ${newSkill.description}\ntriggers:\n${triggerLine}\ntools: [${newSkill.tools}]\nenabled: true\n---\n\n${newSkill.body}`;
    try {
      await skillsAPI.create({ name: newSkill.name, content });
      setShowCreateFlow(false);
      setNewSkill({ name: "", description: "", triggerType: "keyword", triggerValue: "", tools: "", body: "Describe what this skill does." });
      setCreateStep("info");
      loadSkills();
    } catch (err) { console.error("Create failed:", err); }
  };

  const openEditor = (skill: SkillInfo) => {
    setEditorName(skill.name);
    setEditorContent(`---\nname: ${skill.name}\ndescription: ${skill.description}\ntriggers: ${JSON.stringify(skill.triggers)}\ntools: ${JSON.stringify(skill.tools)}\nenabled: ${skill.enabled}\n---\n\n${skill.description}`);
    setShowEditor(true);
  };

  const getTriggerLabel = (skill: SkillInfo): string => {
    const triggers: string[] = [];
    for (const t of skill.triggers) {
      if (t.cron) triggers.push(`cron: ${t.cron}`);
      if (t.keyword) triggers.push(`"${t.keyword}"`);
    }
    return triggers.join(", ") || "manual";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <h1 className="text-sm font-semibold text-white">Skills</h1>
        <button onClick={() => setShowCreateFlow(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/15 text-indigo-300 rounded-lg text-xs hover:bg-indigo-500/25 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Skill
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Create flow */}
        {showCreateFlow && (
          <div className="p-6 animate-slide-up">
            <div className="bg-surface-2 rounded-xl border border-indigo-500/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Create Skill</h2>
                <div className="flex gap-1">
                  {(["info", "trigger", "code"] as CreateStep[]).map((s, i) => (
                    <div key={s} className={cn("w-2 h-2 rounded-full transition-colors", createStep === s ? "bg-indigo-400" : "bg-surface-4")} />
                  ))}
                </div>
              </div>

              {createStep === "info" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Name</label>
                    <input type="text" value={newSkill.name} onChange={e => setNewSkill({...newSkill, name: e.target.value})}
                      placeholder="my-skill" className="w-full px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input type="text" value={newSkill.description} onChange={e => setNewSkill({...newSkill, description: e.target.value})}
                      placeholder="What does this skill do?" className="w-full px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  </div>
                  <button onClick={() => setCreateStep("trigger")} disabled={!newSkill.name}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">Next</button>
                </div>
              )}

              {createStep === "trigger" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Trigger Type</label>
                    <select value={newSkill.triggerType} onChange={e => setNewSkill({...newSkill, triggerType: e.target.value as "keyword" | "cron" | "manual"})}
                      className="w-full px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none">
                      <option value="keyword">Keyword</option><option value="cron">Cron Schedule</option><option value="manual">Manual Only</option>
                    </select>
                  </div>
                  {newSkill.triggerType !== "manual" && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{newSkill.triggerType === "cron" ? "Cron Expression" : "Keyword"}</label>
                      <input type="text" value={newSkill.triggerValue} onChange={e => setNewSkill({...newSkill, triggerValue: e.target.value})}
                        placeholder={newSkill.triggerType === "cron" ? "0 7 * * *" : "morning briefing"}
                        className="w-full px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-indigo-500/40" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tools (comma separated)</label>
                    <input type="text" value={newSkill.tools} onChange={e => setNewSkill({...newSkill, tools: e.target.value})}
                      placeholder="web_search, exec" className="w-full px-3 py-2 bg-surface-3 border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/40" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCreateStep("info")} className="px-4 py-2 bg-surface-3 text-gray-300 rounded-lg text-sm">Back</button>
                    <button onClick={() => setCreateStep("code")} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm">Next</button>
                  </div>
                </div>
              )}

              {createStep === "code" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Skill Instructions</label>
                    <textarea value={newSkill.body} onChange={e => setNewSkill({...newSkill, body: e.target.value})}
                      className="w-full h-48 px-3 py-2 bg-surface-1 border border-white/[0.08] rounded-lg text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500/40" spellCheck={false} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCreateStep("trigger")} className="px-4 py-2 bg-surface-3 text-gray-300 rounded-lg text-sm">Back</button>
                    <button onClick={handleCreate} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm">Create Skill</button>
                    <button onClick={() => { setShowCreateFlow(false); setCreateStep("info"); }} className="px-4 py-2 bg-surface-3 text-gray-400 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Editor */}
        {showEditor && (
          <div className="p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Editing: {editorName}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs"><Save className="w-3.5 h-3.5" />Save</button>
                <button onClick={() => setShowEditor(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-xs"><X className="w-3.5 h-3.5" />Cancel</button>
              </div>
            </div>
            <textarea value={editorContent} onChange={e => setEditorContent(e.target.value)}
              className="w-full h-96 px-4 py-3 bg-surface-1 border border-white/[0.06] rounded-xl text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500/40" spellCheck={false} />
          </div>
        )}

        {/* Skill cards */}
        {!showEditor && !showCreateFlow && (
          <div className="p-6">
            {loading ? (
              <div className="text-center text-gray-600 py-12">Loading skills...</div>
            ) : skills.length === 0 ? (
              <div className="text-center text-gray-600 py-12">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No skills installed</p>
                <p className="text-xs mt-1 text-gray-700">Create a skill to teach Nexus new abilities</p>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                {skills.map(skill => (
                  <div key={skill.name}
                    className={cn(
                      "bg-surface-2 rounded-xl p-4 border transition-all cursor-pointer hover:border-indigo-500/20",
                      skill.enabled ? "border-white/[0.04]" : "border-white/[0.02] opacity-50"
                    )}
                    onClick={() => openEditor(skill)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", skill.enabled ? "bg-amber-500/15" : "bg-surface-3")}>
                          <Zap className={cn("w-3.5 h-3.5", skill.enabled ? "text-amber-400" : "text-gray-600")} />
                        </div>
                        <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleToggle(skill.name, skill.enabled); }}
                        className="text-gray-400 hover:text-white transition-colors">
                        {skill.enabled ? <ToggleRight className="w-5 h-5 text-indigo-400" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{skill.description || "No description"}</p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-600">
                      <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{getTriggerLabel(skill)}</span>
                      {skill.lastRun && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimestamp(skill.lastRun)}</span>}
                      <button onClick={e => { e.stopPropagation(); handleDelete(skill.name); }}
                        className="ml-auto text-gray-700 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
