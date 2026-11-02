import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Scissors,
  Play,
  Square,
  AlertCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  History,
  CheckCircle2,
} from 'lucide-react';
import { useAiStore } from '../../store/aiStore';
import { usePlayerStore } from '../../store/playerStore';
import { formatTime } from '../../utils/formatters';

interface ResourceStats {
  cpu_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  disk_used_bytes: number | null;
  disk_total_bytes: number | null;
  gpu_percent: number | null;
  gpu_memory_used_bytes: number | null;
  gpu_memory_total_bytes: number | null;
}

const formatEta = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) return '—';
  const gb = bytes / 1024 ** 3;
  return `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)}G`;
};

const formatTokenCount = (tokens?: number): string => {
  if (tokens === undefined) return '—';
  if (tokens < 1000) return String(Math.round(tokens));
  return `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k`;
};

const formatTokenRate = (tokensPerSecond?: number): string =>
  tokensPerSecond === undefined ? '—' : `${tokensPerSecond.toFixed(tokensPerSecond >= 10 ? 0 : 1)} tok/s`;

const formatSeconds = (seconds?: number): string =>
  seconds === undefined ? '—' : seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;

export const TaskQueueView: React.FC = () => {
  const filePath = usePlayerStore((s) => s.filePath);
  const duration = usePlayerStore((s) => s.duration);

  const currentTask = useAiStore((s) => s.currentTask);
  const cancelCurrentTask = useAiStore((s) => s.cancelCurrentTask);
  const runSceneDetection = useAiStore((s) => s.runSceneDetection);

  const sceneConfig = useAiStore((s) => s.sceneConfig);
  const updateSceneConfig = useAiStore((s) => s.updateSceneConfig);

  const selectedVisionModelId = useAiStore((s) => s.selectedVisionModelId);
  const sessions = useAiStore((s) => s.sessions);

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [resourceStats, setResourceStats] = useState<ResourceStats | null>(null);
  const [etaEstimate, setEtaEstimate] = useState<{ seconds: number; updatedAt: number } | null>(null);
  const [etaClock, setEtaClock] = useState(Date.now());

  useEffect(() => {
    if (currentTask?.status !== 'running') {
      setResourceStats(null);
      return;
    }

    let active = true;
    const refreshStats = () => {
      void invoke<ResourceStats>('get_resource_stats')
        .then((stats) => {
          if (active) setResourceStats(stats);
        })
        .catch(() => {
          if (active) setResourceStats(null);
        });
    };

    refreshStats();
    const timer = window.setInterval(refreshStats, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentTask?.status]);

  useEffect(() => {
    if (currentTask?.status !== 'running') {
      setEtaEstimate(null);
      return;
    }

    const seconds = currentTask.progress.etaSeconds;
    setEtaEstimate(
      seconds === undefined ? null : { seconds, updatedAt: Date.now() }
    );
  }, [currentTask?.id, currentTask?.status, currentTask?.progress]);

  useEffect(() => {
    if (currentTask?.status !== 'running') return;
    const timer = window.setInterval(() => setEtaClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentTask?.status]);

  const session = filePath ? sessions[filePath] : null;
  // Old sessions may contain a 00:00 baseline from earlier detector versions.
  // It is a comparison frame, never an editorial cut marker.
  const cuts = (session?.scenes || []).filter((scene) => scene.timestamp > 0.01);
  const cutsCount = cuts.length;
  const isRunning = currentTask?.status === 'running';
  const displayedEta = etaEstimate
    ? Math.max(0, etaEstimate.seconds - Math.floor((etaClock - etaEstimate.updatedAt) / 1000))
    : undefined;

  const toggleExpand = (card: string) => {
    setExpandedCard(expandedCard === card ? null : card);
  };

  return (
    <div className="space-y-4">
      {/* Currently Running Task Monitor (G1.4, G1.5, PM-05) */}
      {currentTask && (
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-blue-500/30 shadow-xl space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  currentTask.status === 'running'
                    ? 'bg-blue-400 animate-ping'
                    : currentTask.status === 'completed'
                    ? 'bg-emerald-400'
                    : currentTask.status === 'failed'
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-semibold text-white">
                {currentTask.title}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md uppercase font-medium ${
                  currentTask.status === 'running'
                    ? 'bg-blue-500/20 text-blue-300'
                    : currentTask.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : currentTask.status === 'failed'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-zinc-700 text-zinc-300'
                }`}
              >
                {currentTask.status}
              </span>

              {currentTask.status === 'running' && (
                <button
                  onClick={cancelCurrentTask}
                  title="Cancel Task"
                  className="p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs transition-colors cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              )}
            </div>
          </div>

          {/* Honest Progress Bar (PM-05, Section 5) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-zinc-400">
              <span className="truncate pr-2">
                {currentTask.progress.stageDescription ||
                  (currentTask.status === 'completed' ? 'Task completed successfully' : 'Processing...')}
              </span>
              <span
                className={`font-semibold shrink-0 ${
                  currentTask.status === 'completed'
                    ? 'text-emerald-400'
                    : currentTask.status === 'failed'
                    ? 'text-rose-400'
                    : 'text-blue-400'
                }`}
              >
                {currentTask.status === 'completed' ? '100%' : `${currentTask.progress.percent}%`}
              </span>
            </div>

            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  currentTask.status === 'completed'
                    ? 'bg-emerald-500'
                    : currentTask.status === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${currentTask.status === 'completed' ? 100 : currentTask.progress.percent}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-0.5">
              <span>
                {currentTask.status === 'completed'
                  ? `Completed: ${currentTask.progress.currentUnit || currentTask.progress.totalUnits} ${currentTask.progress.unitLabel}`
                  : `Work: ${currentTask.progress.currentUnit} / ${currentTask.progress.totalUnits} ${currentTask.progress.unitLabel}`}
              </span>
              {currentTask.status === 'running' && (
                <span aria-live="polite" aria-label="Estimated time remaining" className="shrink-0 text-blue-300">
                  {displayedEta !== undefined
                    ? formatEta(displayedEta)
                    : '—:—'}
                </span>
              )}
            </div>
            {currentTask.status === 'running' && (
              <div
                className="grid grid-cols-4 gap-2 border-t border-white/5 pt-2 text-[10px] font-mono text-zinc-400"
                aria-label="System resource usage"
              >
                <span title="CPU usage">CPU {resourceStats ? `${Math.round(resourceStats.cpu_percent)}%` : '—'}</span>
                <span title="System memory used / total">RAM {resourceStats ? `${formatBytes(resourceStats.memory_used_bytes)}/${formatBytes(resourceStats.memory_total_bytes)}` : '—'}</span>
                <span title="GPU usage and VRAM">
                  GPU {resourceStats?.gpu_percent !== null && resourceStats?.gpu_percent !== undefined
                    ? `${Math.round(resourceStats.gpu_percent)}% ${formatBytes(resourceStats.gpu_memory_used_bytes)}/${formatBytes(resourceStats.gpu_memory_total_bytes)}`
                    : '—'}
                </span>
                <span title="System disk used / total">
                  DISK {resourceStats?.disk_used_bytes != null
                    ? `${formatBytes(resourceStats.disk_used_bytes)}/${formatBytes(resourceStats.disk_total_bytes ?? null)}`
                    : '—'}
                </span>
              </div>
            )}
            {currentTask.modelId && (
              <div
                className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-[10px] font-mono text-zinc-400 sm:grid-cols-3"
                aria-label="AI model inference details"
              >
                <span className="col-span-2 truncate text-blue-300" title={currentTask.modelId}>
                  MODEL {currentTask.modelId}
                </span>
                <span title="Completed model requests">
                  REQ {currentTask.progress.modelStats?.requestCount ?? 0}
                </span>
                <span title="Input tokens sent to the model">
                  IN {formatTokenCount(currentTask.progress.modelStats?.inputTokens)} tok
                </span>
                <span title="Tokens generated by the model">
                  OUT {formatTokenCount(currentTask.progress.modelStats?.outputTokens)} tok
                </span>
                <span title="Input and output tokens combined">
                  TOTAL {formatTokenCount(currentTask.progress.modelStats?.totalTokens)} tok
                </span>
                <span title="Average output generation rate">
                  SPEED {formatTokenRate(currentTask.progress.modelStats?.outputTokensPerSecond)}
                </span>
                <span title="Time spent generating model output">
                  GEN {formatSeconds(currentTask.progress.modelStats?.generationSeconds)}
                </span>
                {currentTask.progress.modelStats?.contextWindowTokens !== undefined && (
                  <span title="Context window requested for this model call">
                    CTX {formatTokenCount(currentTask.progress.modelStats.contextWindowTokens)} tok
                  </span>
                )}
              </div>
            )}
          </div>

          {currentTask.error && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="font-mono text-[11px]">{currentTask.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Task Cards List */}
      <div className="space-y-2.5">
        {/* TASK 1: Scene Detection Engine (G3.1 - G3.6) */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Scene Cut Detection
                </div>
                <div className="text-[11px] text-zinc-500">
                  {sceneConfig.useVisionVerification
                    ? selectedVisionModelId
                      ? `Vision model confirms each cut (${selectedVisionModelId})`
                      : 'Vision review is on — select a model to avoid visual fallback'
                    : 'Fast offline visual difference'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => toggleExpand('scene')}
                title="Configure"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>

              <button
                disabled={!filePath || isRunning}
                onClick={() => filePath && duration > 0 && runSceneDetection(filePath, duration)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </button>
            </div>
          </div>

          {/* Collapsible Config */}
          {expandedCard === 'scene' && (
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-3 text-xs animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300">
                  <span>Sensitivity (Threshold)</span>
                  <span className="font-mono text-blue-400">
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
                  className="w-full accent-blue-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300">
                  <span>Min Scene Duration</span>
                  <span className="font-mono text-blue-400">
                    {sceneConfig.minSceneDurationSeconds}s
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="10.0"
                  step="0.5"
                  value={sceneConfig.minSceneDurationSeconds}
                  onChange={(e) =>
                    updateSceneConfig({
                      minSceneDurationSeconds: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-blue-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                />
              </div>

              {sceneConfig.useVisionVerification && (
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-300">
                    <span>AI Review Limit</span>
                    <span className="font-mono text-blue-400">
                      {sceneConfig.maxVisionCandidates} candidates
                    </span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="48"
                    step="4"
                    value={sceneConfig.maxVisionCandidates}
                    onChange={(e) =>
                      updateSceneConfig({ maxVisionCandidates: parseInt(e.target.value, 10) })
                    }
                    aria-label="Maximum scene-cut candidates reviewed by the vision model"
                    className="w-full accent-blue-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                  />
                  <div className="text-[10px] text-zinc-500">
                    Higher limits improve coverage but take longer and use more model inference.
                  </div>
                </div>
              )}

              <label className="flex items-center justify-between text-zinc-300 cursor-pointer pt-1">
                <span>Capture Scene Thumbnails</span>
                <input
                  type="checkbox"
                  checked={sceneConfig.generateThumbnails}
                  onChange={(e) =>
                    updateSceneConfig({ generateThumbnails: e.target.checked })
                  }
                  className="rounded bg-zinc-800 border-zinc-700 text-blue-600 w-3.5 h-3.5 cursor-pointer"
                />
              </label>

              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="flex items-center justify-between text-zinc-200 cursor-pointer">
                  <span className="space-y-0.5">
                    <span className="block">Let Vision Model confirm cuts</span>
                    <span className="block text-[10px] text-zinc-500">
                      The visual scan only proposes candidates; AI decides which markers remain.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={sceneConfig.useVisionVerification}
                    onChange={(e) => updateSceneConfig({ useVisionVerification: e.target.checked })}
                    className="rounded bg-zinc-800 border-zinc-700 text-blue-600 w-3.5 h-3.5 cursor-pointer"
                  />
                </label>

                {sceneConfig.useVisionVerification && (
                  <div className="text-[10px] leading-relaxed text-zinc-500" role="status">
                    {selectedVisionModelId
                      ? `Reviewer: ${selectedVisionModelId}. Up to ${sceneConfig.maxVisionCandidates} candidates are checked, and unverified cuts are not placed on the timeline.`
                      : 'No vision model is selected, so this run will use the offline visual fallback. Choose a vision model in Provider Manager for AI-confirmed cuts.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {cutsCount > 0 && (
            <div className="space-y-2 border-t border-white/5 pt-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center space-x-1 text-emerald-400">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                  {cutsCount} AI-confirmed cut{cutsCount === 1 ? '' : 's'}
                </span>
                <span className="font-mono text-zinc-500">Click a green marker on timeline</span>
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="AI-confirmed cut times">
                {cuts.slice(0, 8).map((cut) => (
                  <span
                    key={cut.id}
                    className="rounded-md border border-emerald-400/15 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200"
                    title={`AI-confirmed cut at ${formatTime(cut.timestamp)}`}
                  >
                    {formatTime(cut.timestamp)}
                  </span>
                ))}
                {cutsCount > 8 && (
                  <span className="px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">+{cutsCount - 8} more</span>
                )}
              </div>
            </div>
          )}

          {currentTask?.type === 'scene_detection' && currentTask.status === 'completed' && cutsCount === 0 && (
            <div className="border-t border-white/5 pt-2 text-[11px] text-amber-300" role="status">
              No AI-confirmed cuts were found, so no timeline marker was added.
            </div>
          )}
        </div>

      </div>

      {/* Task History Accordion (UI-08) */}
      {session && session.taskHistory.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5 text-zinc-500" />
              <span>Session History ({session.taskHistory.length} runs)</span>
            </div>
            {showHistory ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {session.taskHistory.slice().reverse().map((th) => (
                <div
                  key={th.id}
                  className="p-2 rounded-xl bg-white/5 border border-white/5 text-[11px] flex items-center justify-between font-mono"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        th.status === 'completed'
                          ? 'bg-emerald-400'
                          : th.status === 'cancelled'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                    />
                    <span className="text-zinc-300 truncate">{th.title}</span>
                  </div>
                  <span className="text-zinc-500 shrink-0 ml-2">
                    {th.startTime ? new Date(th.startTime).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
