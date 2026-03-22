"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Plus, Trash2, Clock, Tag, ToggleLeft, ToggleRight, Save, X, Play, Code,
  MessageSquare, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp, Sparkles, Lightbulb,
} from "lucide-react";
import { skillsAPI, type SkillInfo, type SkillExecution, type SkillSuggestion } from "@/lib/api";
import { cn, formatTimestamp } from "@/lib/utils";

type BuilderStep = "describe" | "review" | "installed";

export default function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [editorName, setEditorName] = useState("");

  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState<BuilderStep>("describe");
  const [description, setDescription] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [editableCode, setEditableCode] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState<{ name: string; success: boolean; output: string } | null>(null);

  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [suggestionChecked, setSuggestionChecked] = useState(false);

  useEffect(() => { loadSkills(); }, []);

  useEffect(() => {
    if (suggestionChecked) return;
    setSuggestionChecked(true);
    skillsAPI.getSuggestions()
      .then(data => {
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, [suggestionChecked]);

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

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const result = await skillsAPI.generate(description);
      if (result.success && result.generatedSkill) {
        setGeneratedCode(result.generatedSkill);
        setEditableCode(result.generatedSkill);
        setBuilderStep("review");
      } else {
        setGenerateError(result.error || "Failed to generate skill");
      }
    } catch (err: unknown) {
      setGenerateError((err as Error).message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [description]);

  const handleRegenerate = () => {
    setBuilderStep("describe");
    setGeneratedCode("");
    setEditableCode("");
    setIsEditing(false);
  };

  const handleInstall = async () => {
    const codeToInstall = isEditing ? editableCode : generatedCode;
    const nameMatch = codeToInstall.match(/name:\s*(.+)/);
    const skillName = nameMatch ? nameMatch[1].trim() : `skill-${Date.now()}`;
    setInstalling(true);
    try {
      await skillsAPI.create({ name: skillName, content: codeToInstall });
      setBuilderStep("installed");
      loadSkills();
    } catch (err: unknown) {
      setGenerateError((err as Error).message || "Installation failed");
    } finally {
      setInstalling(false);
    }
  };

  const resetBuilder = () => {
    setShowBuilder(false);
    setBuilderStep("describe");
    setDescription("");
    setGeneratedCode("");
    setEditableCode("");
    setIsEditing(false);
    setGenerateError("");
  };

  const handleRunSkill = async (name: string) => {
    setRunningSkill(name);
    setRunOutput(null);
    try {
      const result = await skillsAPI.run(name);
      setRunOutput({ name, success: result.success, output: result.output || result.error || "No output" });
      loadSkills();
    } catch (err: unknown) {
      setRunOutput({ name, success: false, output: (err as Error).message || "Execution failed" });
    } finally {
      setRunningSkill(null);
    }
  };

  const handleUseSuggestion = (suggestion: SkillSuggestion) => {
    setDescription(suggestion.skillDescription);
    setShowBuilder(true);
    setBuilderStep("describe");
    setSuggestionDismissed(true);
  };

  const getExplanation = (code: string): string => {
    const parts = code.split("---");
    if (parts.length >= 3) {
      const body = parts.slice(2).join("---").trim();
      return body.split("\n").slice(0, 3).join(" ").slice(0, 200);
    }
    return "This skill will execute based on the configured triggers.";
  };

  const getTriggerInfo = (code: string): string => {
    const cronMatch = code.match(/cron:\s*"([^"]+)"/);
    const keywordMatch = code.match(/keyword:\s*"([^"]+)"/);
    if (cronMatch) return `Runs on schedule: ${cronMatch[1]}`;
    if (keywordMatch) return `Triggered by: "${keywordMatch[1]}"`;
    return "Manual trigger";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] glass">
        <h1 className="text-sm font-semibold text-white">Skills</h1>
        <button onClick={() => setShowBuilder(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/15 text-indigo-300 rounded-lg text-xs hover:bg-indigo-500/25 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Create Skill
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Proactive suggestion banner */}
        {suggestions.length > 0 && !suggestionDismissed && !showBuilder && !showEditor && (
          <div className="mx-6 mt-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20 p-4 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">Skill suggestion</h3>
                <p className="text-xs text-gray-400 mb-3">{suggestions[0].description}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleUseSuggestion(suggestions[0])}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600 transition-colors">
                    <Sparkles className="w-3 h-3" /> Create this skill
                  </button>
                  <button onClick={() => setSuggestionDismissed(true)}
                    className="px-3 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-xs hover:text-gray-300 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversational Skill Builder */}
        {showBuilder && (
          <div className="p-6 animate-slide-up">
            <div className="bg-surface-2 rounded-xl border border-indigo-500/20 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">
                    {builderStep === "describe" ? "Describe your skill" :
                     builderStep === "review" ? "Review generated skill" :
                     "Skill installed!"}
                  </h2>
                </div>
                <button onClick={resetBuilder} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5">
                {builderStep === "describe" && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                      Tell me what you want this skill to do in plain English. I&apos;ll generate the skill code for you.
                    </p>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Every Monday morning, summarise my most important memories and send me a briefing via Telegram..."
                      className="w-full h-28 px-4 py-3 bg-surface-1 border border-white/[0.08] rounded-xl text-white text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500/40 placeholder-gray-600"
                      autoFocus
                    />
                    {generateError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" /> {generateError}
                      </div>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={!description.trim() || generating}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                    >
                      {generating ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> Generate Skill</>
                      )}
                    </button>
                  </div>
                )}

                {builderStep === "review" && (
                  <div className="space-y-4">
                    <div className="bg-surface-1 rounded-lg p-3 border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-white">What this skill will do</span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{getExplanation(isEditing ? editableCode : generatedCode)}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500">
                        <Clock className="w-3 h-3" /> {getTriggerInfo(isEditing ? editableCode : generatedCode)}
                      </div>
                    </div>

                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 font-medium">Generated skill code</span>
                        <button
                          onClick={() => { setIsEditing(!isEditing); if (!isEditing) setEditableCode(generatedCode); }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                        >
                          <Code className="w-3 h-3" /> {isEditing ? "View original" : "Edit"}
                        </button>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editableCode}
                          onChange={e => setEditableCode(e.target.value)}
                          className="w-full h-64 px-4 py-3 bg-surface-1 border border-indigo-500/30 rounded-xl text-gray-200 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:border-indigo-500/50"
                          spellCheck={false}
                        />
                      ) : (
                        <pre className="w-full max-h-64 overflow-auto px-4 py-3 bg-surface-1 border border-white/[0.06] rounded-xl text-gray-300 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                          {generatedCode}
                        </pre>
                      )}
                    </div>

                    {generateError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" /> {generateError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleInstall}
                        disabled={installing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-500/90 text-white rounded-lg text-sm hover:bg-green-500 transition-colors disabled:opacity-50"
                      >
                        {installing ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Installing...</>
                        ) : (
                          <><Check className="w-3.5 h-3.5" /> Accept &amp; Install</>
                        )}
                      </button>
                      <button
                        onClick={handleRegenerate}
                        className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 text-gray-300 rounded-lg text-sm hover:text-white transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                      </button>
                    </div>
                  </div>
                )}

                {builderStep === "installed" && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                      <Check className="w-6 h-6 text-green-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">Skill installed!</h3>
                    <p className="text-xs text-gray-400 mb-4">Your skill is ready. You can test it with the &quot;Run now&quot; button.</p>
                    <div className="flex justify-center gap-2">
                      <button onClick={resetBuilder}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition-colors">
                        Done
                      </button>
                      <button onClick={() => { resetBuilder(); setShowBuilder(true); }}
                        className="px-4 py-2 bg-surface-3 text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                        Create another
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

        {/* Run output */}
        {runOutput && (
          <div className="mx-6 mt-4 bg-surface-2 rounded-xl border border-white/[0.06] p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {runOutput.success ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm font-medium text-white">
                  {runOutput.name} &#8212; {runOutput.success ? "Success" : "Failed"}
                </span>
              </div>
              <button onClick={() => setRunOutput(null)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="max-h-48 overflow-auto px-3 py-2 bg-surface-1 rounded-lg text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {runOutput.output}
            </pre>
          </div>
        )}

        {/* Skill cards */}
        {!showEditor && !showBuilder && (
          <div className="p-6">
            {loading ? (
              <div className="text-center text-gray-600 py-12">Loading skills...</div>
            ) : skills.length === 0 ? (
              <div className="text-center text-gray-600 py-12">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No skills installed</p>
                <p className="text-xs mt-1 text-gray-700">Click &quot;Create Skill&quot; to describe what you want in plain English</p>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1">
                {skills.map(skill => (
                  <div key={skill.name}
                    className={cn(
                      "bg-surface-2 rounded-xl border transition-all",
                      skill.enabled ? "border-white/[0.04]" : "border-white/[0.02] opacity-50"
                    )}>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", skill.enabled ? "bg-amber-500/15" : "bg-surface-3")}>
                            <Zap className={cn("w-3.5 h-3.5", skill.enabled ? "text-amber-400" : "text-gray-600")} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
                            {skill.hasNeverRun && (
                              <span className="text-[10px] text-amber-400/80 font-medium">never run</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleRunSkill(skill.name)}
                            disabled={runningSkill === skill.name}
                            className="flex items-center gap-1 px-2 py-1 bg-green-500/15 text-green-400 rounded-md text-[10px] hover:bg-green-500/25 transition-colors disabled:opacity-50"
                          >
                            {runningSkill === skill.name ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            {runningSkill === skill.name ? "Running..." : "Run now"}
                          </button>
                          <button onClick={() => handleToggle(skill.name, skill.enabled)}
                            className="text-gray-400 hover:text-white transition-colors">
                            {skill.enabled ? <ToggleRight className="w-5 h-5 text-indigo-400" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{skill.description || "No description"}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-600">
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{getTriggerLabel(skill)}</span>
                        {skill.lastRun && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimestamp(skill.lastRun)}</span>}
                        <button onClick={() => openEditor(skill)}
                          className="text-gray-600 hover:text-indigo-400 transition-colors flex items-center gap-1">
                          <Code className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => handleDelete(skill.name)}
                          className="ml-auto text-gray-700 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>

                    {skill.executions && skill.executions.length > 0 && (
                      <div className="border-t border-white/[0.04]">
                        <button
                          onClick={() => setExpandedHistory(expandedHistory === skill.name ? null : skill.name)}
                          className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
                        >
                          <span>Last {Math.min(skill.executions.length, 5)} runs</span>
                          {expandedHistory === skill.name ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedHistory === skill.name && (
                          <div className="px-4 pb-3 space-y-1.5">
                            {skill.executions.slice(0, 5).map((exec) => (
                              <div key={exec.id}>
                                <button
                                  onClick={() => setExpandedExecution(expandedExecution === exec.id ? null : exec.id)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-surface-1 rounded-lg text-[10px] hover:bg-surface-3 transition-colors"
                                >
                                  {exec.success ? (
                                    <Check className="w-3 h-3 text-green-400 shrink-0" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                                  )}
                                  <span className="text-gray-400 truncate flex-1 text-left">
                                    {(exec.output || exec.error || "No output").slice(0, 60)}
                                    {(exec.output || exec.error || "").length > 60 ? "..." : ""}
                                  </span>
                                  <span className="text-gray-600 shrink-0">{formatTimestamp(exec.timestamp)}</span>
                                  <span className="text-gray-600 shrink-0">{exec.duration_ms}ms</span>
                                </button>
                                {expandedExecution === exec.id && (
                                  <pre className="mt-1 px-3 py-2 bg-surface-1 rounded-lg text-[10px] text-gray-400 font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                                    {exec.output || exec.error || "No output"}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
