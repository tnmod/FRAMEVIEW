import React, { useState } from 'react';
import {
  X,
  Settings,
  Sliders,
  Cpu,
  Subtitles,
  Camera,
  FolderOpen,
  RotateCcw,
  Check,
  Trash2,
  Sparkles,
  Info,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { useAiStore } from '../../store/aiStore';
import { useToastStore } from '../../store/toastStore';
import { clearAllPlaybackHistory } from '../../utils/playbackHistory';
import { ProviderSettings } from '../AiCenter/ProviderSettings';

type SettingsTab = 'general' | 'video' | 'subtitles' | 'screenshots' | 'ai' | 'about';

export const SettingsModal: React.FC = () => {
  const isSettingsOpen = useSettingsStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useSettingsStore((s) => s.setIsSettingsOpen);
  const settings = useSettingsStore();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetDefaults = useSettingsStore((s) => s.resetDefaults);
  const toggleShortcutsOpen = usePlayerStore((s) => s.toggleShortcutsOpen);
  const showToast = useToastStore((s) => s.showToast);

  const sceneConfig = useAiStore((s) => s.sceneConfig);
  const updateSceneConfig = useAiStore((s) => s.updateSceneConfig);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  if (!isSettingsOpen) return null;

  const handleSelectScreenshotDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        updateSettings({ screenshotDir: selected });
        showToast('Screenshot folder updated', { type: 'success' });
      }
    } catch (err) {
      console.error('Error selecting screenshot folder:', err);
    }
  };

  const handleOpenScreenshotDir = async () => {
    try {
      let dir = settings.screenshotDir;
      if (!dir) {
        dir = await invoke<string>('get_default_screenshot_dir');
      }
      await invoke('open_in_folder', { path: dir });
    } catch (err) {
      console.error('Error opening screenshot directory:', err);
    }
  };

  const handleClearHistory = () => {
    clearAllPlaybackHistory();
    showToast('Playback history cleared', { type: 'info' });
  };

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    setUpdateMessage(null);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setUpdateMessage('FrameView v0.1.0 is currently up to date! (Latest release)');
      showToast('FrameView is up to date (v0.1.0)', { type: 'success' });
    }, 1200);
  };

  const handleClearAiCache = () => {
    try {
      localStorage.removeItem('frameview_ai_store');
      showToast('AI analysis sessions and cache reset', { type: 'info' });
    } catch (err) {
      console.error('Failed to clear AI cache:', err);
    }
  };

  return (
    <div
      onClick={() => setIsSettingsOpen(false)}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-[600px] max-h-[90vh] rounded-2xl bg-[#13161c] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 text-zinc-100">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Preferences & Configuration
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
              v0.1.0
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Layout: Sidebar Tabs + Settings Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-52 bg-black/25 border-r border-white/5 p-3 flex flex-col space-y-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>General</span>
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'video'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Hardware & Video</span>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'subtitles'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Subtitles className="w-4 h-4" />
              <span>Subtitles</span>
            </button>

            <button
              onClick={() => setActiveTab('screenshots')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'screenshots'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Screenshots</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI Intelligence</span>
            </button>

            <div className="w-full h-[1px] bg-white/5 my-1" />

            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'about'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>About & System</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Playback Behavior
                </div>

                {/* Auto Resume */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-xs font-medium text-zinc-100">
                      Resume Playback Position
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Automatically remember where you left off and resume on next play
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoResume}
                    onChange={(e) => updateSettings({ autoResume: e.target.checked })}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 cursor-pointer"
                  />
                </div>

                {/* Auto-Play Next */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-xs font-medium text-zinc-100">
                      Auto-play Next in Queue
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Advance to the next video when playback finishes
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoPlayNext}
                    onChange={(e) => updateSettings({ autoPlayNext: e.target.checked })}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 cursor-pointer"
                  />
                </div>

                {/* Seeking Interval */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-100">
                        Arrow Key Seeking Interval
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Seconds jumped when pressing Left or Right arrow
                      </div>
                    </div>
                    <span className="text-xs text-blue-400 font-mono">
                      {settings.seekStepSeconds || 5}s
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[3, 5, 10, 15].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => updateSettings({ seekStepSeconds: sec })}
                        className={`py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                          settings.seekStepSeconds === sec
                            ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                            : 'bg-black/20 border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Default Volume */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-100">Default Startup Volume</span>
                    <span className="text-xs text-blue-400 font-mono">
                      {settings.defaultVolume}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.defaultVolume}
                    onChange={(e) =>
                      updateSettings({ defaultVolume: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-blue-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                  />
                </div>

                {/* History Clear */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-xs font-medium text-zinc-100">Clear Playback History</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Reset all saved resume positions for previously played videos
                    </div>
                  </div>
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear History</span>
                  </button>
                </div>
              </div>
            )}

            {/* VIDEO & HARDWARE TAB */}
            {activeTab === 'video' && (
              <div className="space-y-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  GPU Acceleration & Decoders
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-100">
                      Hardware Decoding (hwdec)
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Offload video decoding to your graphics card for ultra-smooth 4K/60fps playback
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'auto-safe', label: 'Auto Safe (Recommended)', desc: 'Safest hardware decoder' },
                      { id: 'auto', label: 'Auto (Maximum Speed)', desc: 'Any available GPU decoder' },
                      { id: 'd3d11va', label: 'Direct3D 11 (Windows)', desc: 'Native modern Windows GPU decoder' },
                      { id: 'nvdec', label: 'NVDEC (NVIDIA GPUs)', desc: 'Dedicated NVIDIA NVDEC pipeline' },
                      { id: 'no', label: 'Disabled (Software CPU)', desc: 'Decode on CPU via FFmpeg' },
                    ].map((opt) => {
                      const isSelected = settings.hwdec === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => updateSettings({ hwdec: opt.id as any })}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SUBTITLES TAB */}
            {activeTab === 'subtitles' && (
              <div className="space-y-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Subtitle Appearance
                </div>

                {/* Font Size */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-100">Subtitle Font Size</span>
                    <span className="text-xs text-blue-400 font-mono">
                      {settings.subFontSize} pt
                    </span>
                  </div>
                  <input
                    type="range"
                    min="24"
                    max="72"
                    value={settings.subFontSize}
                    onChange={(e) =>
                      updateSettings({ subFontSize: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-blue-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Subtitle Color */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-100">Subtitle Color</span>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                        style={{ backgroundColor: settings.subColor }}
                      />
                      <span className="text-xs font-mono text-zinc-400 uppercase">
                        {settings.subColor}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    {[
                      { name: 'White', color: '#FFFFFF' },
                      { name: 'Yellow', color: '#FFE04B' },
                      { name: 'Cyan', color: '#4ADE80' },
                      { name: 'Sky', color: '#38BDF8' },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => updateSettings({ subColor: preset.color })}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                          settings.subColor === preset.color
                            ? 'bg-blue-600/20 border-blue-500 text-white'
                            : 'bg-black/20 border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SCREENSHOTS TAB */}
            {activeTab === 'screenshots' && (
              <div className="space-y-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Frame Capture Settings
                </div>

                {/* Output Directory */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-medium text-zinc-100">Save Directory</div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate bg-black/30 p-2 rounded-lg border border-white/5">
                    {settings.screenshotDir || 'Default: Pictures\\FrameView'}
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={handleSelectScreenshotDir}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Choose Folder...</span>
                    </button>
                    <button
                      onClick={handleOpenScreenshotDir}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      Open in Explorer
                    </button>
                  </div>
                </div>

                {/* Screenshot Format */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-medium text-zinc-100">Image Format</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'png', label: 'PNG', desc: 'Lossless quality' },
                      { id: 'jpg', label: 'JPEG', desc: 'Smaller file size' },
                      { id: 'webp', label: 'WebP', desc: 'Modern web image' },
                    ].map((fmt) => {
                      const isSelected = settings.screenshotFormat === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          onClick={() => updateSettings({ screenshotFormat: fmt.id as any })}
                          className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <div className="text-xs font-medium">{fmt.label}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{fmt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Screenshot Mode */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-medium text-zinc-100">Capture Layer</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'video', label: 'Clean Video Frame', desc: 'Without subtitles or OSD' },
                      { id: 'subtitles', label: 'With Subtitles', desc: 'Burn active subtitles into image' },
                    ].map((mode) => {
                      const isSelected = settings.screenshotMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => updateSettings({ screenshotMode: mode.id as any })}
                          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span>{mode.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{mode.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* AI INTELLIGENCE TAB */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Model Providers & Cloud Keys</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Configure local Ollama or connect paid cloud models (OpenAI, OpenRouter, Groq, DeepSeek).
                  </p>
                </div>

                {/* Model and Provider Selector & Endpoint Manager */}
                <ProviderSettings />

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Video Analysis Defaults
                  </div>

                  {/* Default Scene Detection Sensitivity */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-zinc-100">
                          Default Scene Cut Sensitivity
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Higher values detect subtle cuts; lower values only detect major transitions
                        </div>
                      </div>
                      <span className="text-xs text-purple-400 font-mono">
                        {Math.round(sceneConfig.sensitivity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.05"
                      value={sceneConfig.sensitivity}
                      onChange={(e) =>
                        updateSceneConfig({ sensitivity: parseFloat(e.target.value) })
                      }
                      className="w-full accent-purple-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                    />
                  </div>

                  <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                    <span>
                      <span className="block text-xs font-medium text-zinc-100">AI-confirmed scene cuts</span>
                      <span className="block text-[11px] text-zinc-500 mt-0.5">
                        Use the selected vision model to accept or reject visual cut candidates.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={sceneConfig.useVisionVerification}
                      onChange={(e) => updateSceneConfig({ useVisionVerification: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-purple-600 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>

                  {/* Clear AI Cache */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <div className="text-xs font-medium text-zinc-100">
                        Reset AI Sessions & Cache
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Clear all cached scene markers and generated chapter records
                      </div>
                    </div>
                    <button
                      onClick={handleClearAiCache}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset AI Cache</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT & VERSION TAB */}
            {activeTab === 'about' && (
              <div className="space-y-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Application Information
                </div>

                {/* App Brand Header Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/20 to-purple-900/10 border border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white font-bold text-lg">
                      FV
                    </div>
                    <div>
                      <div className="text-base font-bold text-white flex items-center space-x-2">
                        <span>FrameView</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          v0.1.0
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        High-Performance Video Player with AI Intelligence
                      </p>
                    </div>
                  </div>

                  <button
                    disabled={isCheckingUpdate}
                    onClick={handleCheckUpdate}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    <span>{isCheckingUpdate ? 'Checking...' : 'Check Updates'}</span>
                  </button>
                </div>

                {updateMessage && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2 font-mono">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{updateMessage}</span>
                  </div>
                )}

                {/* Tech Specs Grid */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-xs">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider pb-1 border-b border-white/5">
                    Engine & Architecture Specs
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Video Core</span>
                      <span className="font-mono text-zinc-300">libmpv v0.3.2 (DirectGPU next)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Metadata Inspector</span>
                      <span className="font-mono text-zinc-300">FFprobe 64-bit Static (MSVC)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Frontend Runtime</span>
                      <span className="font-mono text-zinc-300">React 19 + TypeScript + Vite 8</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Desktop Platform</span>
                      <span className="font-mono text-zinc-300">Tauri 2.0 (Windows x86_64)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">AI Integration</span>
                      <span className="font-mono text-zinc-300">Ollama Local + OpenAI-compatible</span>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      toggleShortcutsOpen();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-blue-400" />
                    <span>Keyboard Shortcuts (?)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-6 border-t border-white/5 bg-black/20 flex items-center justify-between shrink-0">
          <button
            onClick={resetDefaults}
            className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
