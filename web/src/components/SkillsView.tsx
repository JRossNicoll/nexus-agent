'use client';

import { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Clock,
  Tag,
  ToggleLeft,
  ToggleRight,
  FileText,
  Save,
  X,
} from 'lucide-react';
import { skillsAPI, type SkillInfo } from '@/lib/api';
import { cn, formatTimestamp } from '@/lib/utils';

const SKILL_TEMPLATE = `---
name: my-skill
description: A custom skill
triggers:
  - keyword: "my skill"
tools: []
enabled: true
---

Describe what this skill does and how the agent should behave when this skill is activated.
`;

export default function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState(SKILL_TEMPLATE);
  const [editorName, setEditorName] = useState('');
  const [isNewSkill, setIsNewSkill] = useState(true);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await skillsAPI.getAll();
      setSkills(data);
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
    setLoading(false);
  };

  const handleToggle = async (name: string, currentEnabled: boolean) => {
    try {
      await skillsAPI.toggle(name, !currentEnabled);
      setSkills(prev =>
        prev.map(s => s.name === name ? { ...s, enabled: !currentEnabled } : s)
      );
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete skill "${name}"?`)) return;
    try {
      await skillsAPI.delete(name);
      setSkills(prev => prev.filter(s => s.name !== name));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSave = async () => {
    try {
      if (isNewSkill) {
        if (!editorName) return;
        await skillsAPI.create({
          name: editorName,
          content: editorContent,
        });
      } else {
        await skillsAPI.update(editorName, editorContent);
      }
      setShowEditor(false);
      loadSkills();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const openEditor = (skill?: SkillInfo) => {
    if (skill) {
      setEditorName(skill.name);
      setEditorContent(`---
name: ${skill.name}
description: ${skill.description}
triggers: ${JSON.stringify(skill.triggers)}
tools: ${JSON.stringify(skill.tools)}
enabled: ${skill.enabled}
---

${skill.description}`);
      setIsNewSkill(false);
    } else {
      setEditorName('');
      setEditorContent(SKILL_TEMPLATE);
      setIsNewSkill(true);
    }
    setShowEditor(true);
  };

  const getTriggerLabel = (skill: SkillInfo): string => {
    const triggers: string[] = [];
    for (const t of skill.triggers) {
      if (t.cron) triggers.push(`cron: ${t.cron}`);
      if (t.keyword) triggers.push(`keyword: "${t.keyword}"`);
    }
    return triggers.join(', ') || 'manual';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-gray-800/50 bg-surface-1/50">
        <h1 className="text-lg font-semibold text-white">Skills</h1>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-nexus-600/20 text-nexus-400 rounded-lg text-sm hover:bg-nexus-600/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Skill
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showEditor ? (
          <div className="p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-white">
                  {isNewSkill ? 'Create Skill' : `Edit: ${editorName}`}
                </h2>
                {isNewSkill && (
                  <input
                    type="text"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    placeholder="skill-name"
                    className="px-3 py-1.5 bg-surface-2 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-nexus-600 text-white rounded-lg text-sm hover:bg-nexus-500 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => setShowEditor(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-sm hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full h-96 px-4 py-3 bg-surface-1 border border-gray-700/50 rounded-xl text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-nexus-500/50"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-12">Loading skills...</div>
            ) : skills.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No skills installed</p>
                <p className="text-sm mt-1">Create a skill or add one from ~/.nexus/skills/</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {skills.map(skill => (
                  <div
                    key={skill.name}
                    className={cn(
                      'bg-surface-2 rounded-xl p-4 border transition-colors cursor-pointer hover:border-nexus-500/30',
                      skill.enabled ? 'border-gray-700/50' : 'border-gray-800/30 opacity-60'
                    )}
                    onClick={() => openEditor(skill)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className={cn('w-4 h-4', skill.enabled ? 'text-amber-400' : 'text-gray-600')} />
                        <h3 className="font-semibold text-white">{skill.name}</h3>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(skill.name, skill.enabled); }}
                        className="text-gray-400 hover:text-white"
                      >
                        {skill.enabled ? (
                          <ToggleRight className="w-6 h-6 text-nexus-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </div>

                    <p className="text-sm text-gray-400 mb-3">{skill.description || 'No description'}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {getTriggerLabel(skill)}
                      </span>
                      {skill.tools.length > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {skill.tools.join(', ')}
                        </span>
                      )}
                      {skill.lastRun && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(skill.lastRun)}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(skill.name); }}
                        className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
