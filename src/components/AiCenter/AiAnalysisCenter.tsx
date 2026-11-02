import React, { useEffect } from 'react';
import {
  Sparkles,
  X,
  ListTodo,
  Cpu,
  Settings,
} from 'lucide-react';
import { useAiStore } from '../../store/aiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { TaskQueueView } from './TaskQueueView';
import { ProviderSettings } from './ProviderSettings';

export const AiAnalysisCenter: React.FC = () => {
  const isAiCenterOpen = useAiStore((s) => s.isAiCenterOpen);
  const setIsAiCenterOpen = useAiStore((s) => s.setIsAiCenterOpen);
  const activeTab = useAiStore((s) => s.activeTab);
  const setActiveTab = useAiStore((s) => s.setActiveTab);
  const refreshOllama = useAiStore((s) => s.refreshOllama);
  const toggleSettingsOpen = useSettingsStore((s) => s.toggleSettingsOpen);

  // Auto-refresh Ollama on mount
  useEffect(() => {
    refreshOllama().catch(() => {});
  }, [refreshOllama]);

  useEffect(() => {
    if (activeTab === 'chapters') setActiveTab('tasks');
  }, [activeTab, setActiveTab]);

  if (!isAiCenterOpen) return null;

  const tabs: { id: 'tasks' | 'providers'; label: string; icon: React.ReactNode }[] = [
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-3.5 h-3.5" /> },
    { id: 'providers', label: 'Providers', icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="absolute top-0 right-0 w-96 max-w-[90vw] h-full bg-[#0d0f12]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col z-40 select-none shadow-2xl animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
            AI Intelligence
          </h2>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={toggleSettingsOpen}
            title="App Preferences & Settings (Ctrl+,)"
            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsAiCenterOpen(false)}
            title="Close AI Center"
            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/5 bg-black/20 p-1 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600/30 text-blue-300 font-semibold shadow-sm border border-blue-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'tasks' && <TaskQueueView />}
        {activeTab === 'providers' && <ProviderSettings />}
      </div>
    </aside>
  );
};
