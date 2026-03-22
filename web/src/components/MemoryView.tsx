'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Database,
  Brain,
  Tag,
  Clock,
  Eye,
} from 'lucide-react';
import { memoryAPI, structuredAPI, type SemanticMemory, type StructuredMemory } from '@/lib/api';
import { cn, formatTimestamp } from '@/lib/utils';

type MemoryTab = 'structured' | 'semantic';

export default function MemoryView() {
  const [activeTab, setActiveTab] = useState<MemoryTab>('structured');
  const [structured, setStructured] = useState<StructuredMemory[]>([]);
  const [semantic, setSemantic] = useState<SemanticMemory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ key: '', value: '', category: 'preferences', type: 'string' });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'structured') {
        const data = await structuredAPI.getAll();
        setStructured(data);
      } else {
        const data = await memoryAPI.getMemories({ limit: 100 });
        setSemantic(data);
      }
    } catch (err) {
      console.error('Failed to load memory data:', err);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    setLoading(true);
    try {
      const results = await memoryAPI.searchMemories(searchQuery);
      setSemantic(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setLoading(false);
  };

  const handleSaveStructured = async (key: string) => {
    try {
      await structuredAPI.set(key, { value: editValue });
      setEditingKey(null);
      loadData();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleDeleteStructured = async (key: string) => {
    try {
      await structuredAPI.delete(key);
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDeleteSemantic = async (id: string) => {
    try {
      await memoryAPI.deleteMemory(id);
      setSemantic(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleAddStructured = async () => {
    if (!newEntry.key || !newEntry.value) return;
    try {
      await structuredAPI.set(newEntry.key, {
        value: newEntry.value,
        type: newEntry.type,
        category: newEntry.category,
      });
      setShowAddForm(false);
      setNewEntry({ key: '', value: '', category: 'preferences', type: 'string' });
      loadData();
    } catch (err) {
      console.error('Add failed:', err);
    }
  };

  const handleConsolidate = async () => {
    try {
      const result = await memoryAPI.consolidate();
      alert(`Consolidation complete: ${result.merged} merged, ${result.flagged} flagged`);
      loadData();
    } catch (err) {
      console.error('Consolidation failed:', err);
    }
  };

  const categories = [...new Set(structured.map(s => s.category))].sort();
  const groupedStructured = categories.reduce((acc, cat) => {
    acc[cat] = structured.filter(s => s.category === cat);
    return acc;
  }, {} as Record<string, StructuredMemory[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-gray-800/50 bg-surface-1/50">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-white">Memory</h1>
          <div className="flex bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('structured')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                activeTab === 'structured' ? 'bg-nexus-600/20 text-nexus-400' : 'text-gray-400 hover:text-white'
              )}
            >
              <Database className="w-4 h-4 inline mr-1.5" />
              Structured
            </button>
            <button
              onClick={() => setActiveTab('semantic')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                activeTab === 'semantic' ? 'bg-nexus-600/20 text-nexus-400' : 'text-gray-400 hover:text-white'
              )}
            >
              <Brain className="w-4 h-4 inline mr-1.5" />
              Semantic
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'structured' && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-nexus-600/20 text-nexus-400 rounded-lg text-sm hover:bg-nexus-600/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          )}
          {activeTab === 'semantic' && (
            <button
              onClick={handleConsolidate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 text-amber-400 rounded-lg text-sm hover:bg-amber-600/30 transition-colors"
            >
              Consolidate
            </button>
          )}
        </div>
      </div>

      {/* Search bar for semantic */}
      {activeTab === 'semantic' && (
        <div className="px-6 py-3 border-b border-gray-800/50">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Semantic search across memories..."
                className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-nexus-500/50"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-nexus-600 text-white rounded-lg text-sm hover:bg-nexus-500 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading...
          </div>
        ) : activeTab === 'structured' ? (
          <div className="space-y-6">
            {/* Add form */}
            {showAddForm && (
              <div className="bg-surface-2 rounded-xl p-4 border border-nexus-500/30 animate-fade-in">
                <h3 className="text-sm font-semibold text-white mb-3">Add Memory Entry</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newEntry.key}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, key: e.target.value }))}
                    placeholder="Key"
                    className="px-3 py-2 bg-surface-3 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                  <input
                    type="text"
                    value={newEntry.value}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="Value"
                    className="px-3 py-2 bg-surface-3 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-500/50"
                  />
                  <select
                    value={newEntry.category}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2 bg-surface-3 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none"
                  >
                    <option value="identity">Identity</option>
                    <option value="preferences">Preferences</option>
                    <option value="health">Health</option>
                    <option value="finance">Finance</option>
                    <option value="relationships">Relationships</option>
                    <option value="goals">Goals</option>
                  </select>
                  <select
                    value={newEntry.type}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, type: e.target.value }))}
                    className="px-3 py-2 bg-surface-3 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="list">List</option>
                    <option value="object">Object</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleAddStructured} className="px-3 py-1.5 bg-nexus-600 text-white rounded-lg text-sm">
                    Save
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 bg-surface-3 text-gray-400 rounded-lg text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {categories.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No structured memories yet</p>
                <p className="text-sm mt-1">Add facts about yourself to help Nexus remember</p>
              </div>
            ) : (
              categories.map(category => (
                <div key={category}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{category}</h3>
                  <div className="space-y-1">
                    {groupedStructured[category].map(entry => (
                      <div key={entry.key} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-lg group hover:bg-surface-3 transition-colors">
                        <span className="text-sm font-mono text-nexus-400 min-w-32">{entry.key}</span>
                        {editingKey === entry.key ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 px-2 py-1 bg-surface-1 border border-nexus-500/50 rounded text-white text-sm focus:outline-none"
                              autoFocus
                            />
                            <button onClick={() => handleSaveStructured(entry.key)} className="text-green-400 hover:text-green-300">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingKey(null)} className="text-gray-400 hover:text-gray-300">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-300">{entry.value}</span>
                            <span className="text-xs text-gray-600">{entry.type}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingKey(entry.key); setEditValue(entry.value); }}
                                className="p-1 text-gray-400 hover:text-white"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStructured(entry.key)}
                                className="p-1 text-gray-400 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
          <div className="space-y-3">
            {semantic.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No semantic memories yet</p>
                <p className="text-sm mt-1">Memories are created from conversations</p>
              </div>
            ) : (
              semantic.map(mem => (
                <div key={mem.id} className="bg-surface-2 rounded-xl p-4 group hover:bg-surface-3 transition-colors animate-fade-in">
                  <p className="text-sm text-gray-200 leading-relaxed">{mem.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {mem.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(mem.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {mem.access_count} views
                    </span>
                    <span>confidence: {mem.confidence}</span>
                    <span>{mem.source}</span>
                    <button
                      onClick={() => handleDeleteSemantic(mem.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
