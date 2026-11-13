import { create } from 'zustand';
import {
  AiProviderConfig,
  AiTask,
  AiAnalysisSession,
  SmartChapter,
  SceneDetectionConfig,
  VisionAnalysisConfig,
  SmartChaptersConfig,
  TaskWorkProgress,
} from '../types/ai';
import { ProviderService } from '../services/ai/providerService';
import { SceneDetectionEngine } from '../services/ai/sceneDetection';
import { ChapterEngine } from '../services/ai/chapterEngine';

const STORAGE_KEY_AI = 'frameview_ai_store';
const CURRENT_ANALYSIS_VERSION = 7;

function isUsableVisionSummary(summary: string): boolean {
  const value = summary.trim();
  if (!value || /^(visual transition|scene transition|scene analyzed|section starting at)\b/i.test(value)) {
    return false;
  }
  // A few local models return their JSON response serialized one extra time.
  return !/^\s*(?:"\s*)?\{\s*\\?"(?:summary|description|objects)\\?"\s*:/i.test(value);
}

const DEFAULT_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'ollama_default',
    name: 'Ollama (Local)',
    type: 'ollama',
    endpoint: 'http://localhost:11434',
    isLocal: true,
    isEnabled: true,
    models: [],
    status: 'checking',
  },
];

interface AiPersistedData {
  providers: AiProviderConfig[];
  selectedVisionModelId?: string;
  selectedTextModelId?: string;
  sessions: Record<string, AiAnalysisSession>;
  sceneConfig: SceneDetectionConfig;
  visionConfig: VisionAnalysisConfig;
  chapterConfig: SmartChaptersConfig;
}

const DEFAULT_PERSISTED: AiPersistedData = {
  providers: DEFAULT_PROVIDERS,
  selectedVisionModelId: '',
  selectedTextModelId: '',
  sessions: {},
  sceneConfig: {
    sensitivity: 0.35,
    sampleIntervalSeconds: 0.5,
    minSceneDurationSeconds: 4.0,
    generateThumbnails: true,
    useVisionVerification: true,
    maxVisionCandidates: 24,
  },
  visionConfig: {
    providerId: 'ollama_default',
    modelId: '',
    sampleStrategy: 'scene_keyframes',
    maxFramesToAnalyze: 28,
  },
  chapterConfig: {
    providerId: 'ollama_default',
    modelId: '',
    minChapterDurationSeconds: 15,
    language: 'Vietnamese',
  },
};

function loadPersistedAi(): AiPersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI);
    if (!raw) return DEFAULT_PERSISTED;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PERSISTED,
      ...parsed,
      providers: Array.isArray(parsed.providers) && parsed.providers.length > 0
        ? parsed.providers
        : DEFAULT_PROVIDERS,
      sceneConfig: { ...DEFAULT_PERSISTED.sceneConfig, ...parsed.sceneConfig },
      visionConfig: {
        ...DEFAULT_PERSISTED.visionConfig,
        ...parsed.visionConfig,
        // Existing installs used 20 thumbnails, which is too sparse for meaningful editorial grouping.
        maxFramesToAnalyze: Math.max(24, parsed.visionConfig?.maxFramesToAnalyze || 0),
      },
      chapterConfig: { ...DEFAULT_PERSISTED.chapterConfig, ...parsed.chapterConfig },
    };
  } catch (err) {
    console.warn('Failed to load AI persisted state:', err);
    return DEFAULT_PERSISTED;
  }
}

function sanitizeSessionsForStorage(sessions: Record<string, AiAnalysisSession>): Record<string, AiAnalysisSession> {
  const sanitized: Record<string, AiAnalysisSession> = {};
  const entries = Object.entries(sessions || {});
  // Keep up to 25 most recent sessions
  const recentEntries = entries
    .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
    .slice(0, 25);

  for (const [key, sess] of recentEntries) {
    sanitized[key] = {
      ...sess,
      // Strip heavy base64 strings from scenes in localStorage to prevent 5MB overflow
      scenes: (sess.scenes || []).map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        confidence: s.confidence,
        score: s.score,
        label: s.label,
      })),
      chapters: (sess.chapters || []).map((c) => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
        title: c.title,
        summary: c.summary,
        isManualEdit: c.isManualEdit,
      })),
      visionDescriptions: (sess.visionDescriptions || []).map((vd) => ({
        timestamp: vd.timestamp,
        sceneId: vd.sceneId,
        summary: vd.summary,
        objects: vd.objects,
        activity: vd.activity,
      })),
      taskHistory: (sess.taskHistory || []).slice(-10),
    };
  }
  return sanitized;
}

function persistAi(data: Partial<AiPersistedData>) {
  try {
    const current = loadPersistedAi();
    const dataToSave = { ...data };
    if (dataToSave.sessions) {
      dataToSave.sessions = sanitizeSessionsForStorage(dataToSave.sessions);
    }
    const merged = { ...current, ...dataToSave };
    localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(merged));
  } catch (err) {
    console.warn('Failed to persist AI state, attempting fallback with minimal sessions:', err);
    try {
      const current = loadPersistedAi();
      const minimal = {
        ...current,
        ...data,
        sessions: {},
      };
      localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(minimal));
    } catch {
      // Ignored
    }
  }
}

interface AiState {
  isAiCenterOpen: boolean;
  activeTab: 'tasks' | 'chapters' | 'providers';
  providers: AiProviderConfig[];
  selectedVisionModelId: string;
  selectedTextModelId: string;
  sessions: Record<string, AiAnalysisSession>;
  currentTask: AiTask | null;
  abortController: AbortController | null;

  sceneConfig: SceneDetectionConfig;
  visionConfig: VisionAnalysisConfig;
  chapterConfig: SmartChaptersConfig;

  // Actions
  setIsAiCenterOpen: (open: boolean) => void;
  toggleAiCenterOpen: () => void;
  setActiveTab: (tab: 'tasks' | 'chapters' | 'providers') => void;

  updateSceneConfig: (partial: Partial<SceneDetectionConfig>) => void;
  updateVisionConfig: (partial: Partial<VisionAnalysisConfig>) => void;
  updateChapterConfig: (partial: Partial<SmartChaptersConfig>) => void;

  setSelectedVisionModelId: (id: string) => void;
  setSelectedTextModelId: (id: string) => void;

  // Provider actions
  refreshOllama: (providerId?: string) => Promise<void>;
  addCustomProvider: (config: Omit<AiProviderConfig, 'models' | 'status'>) => Promise<void>;
  updateProvider: (id: string, partial: Partial<AiProviderConfig>) => void;
  removeProvider: (id: string) => void;

  // Session & Chapter actions
  getOrCreateSession: (videoPath: string, duration?: number) => AiAnalysisSession;
  updateChapter: (videoPath: string, chapterId: string, partial: Partial<SmartChapter>) => void;
  deleteChapter: (videoPath: string, chapterId: string) => void;
  addChapter: (videoPath: string, chapter: SmartChapter) => void;
  clearSession: (videoPath: string) => void;

  // Task execution
  runSceneDetection: (videoPath: string, duration: number) => Promise<void>;
  runVisionAnalysis: (videoPath: string) => Promise<void>;
  runSmartChapters: (videoPath: string, duration: number) => Promise<void>;
  cancelCurrentTask: () => void;
}

export const useAiStore = create<AiState>((set, get) => {
  const initial = loadPersistedAi();

  return {
    isAiCenterOpen: false,
    activeTab: 'tasks',
    providers: initial.providers,
    selectedVisionModelId: initial.selectedVisionModelId || '',
    selectedTextModelId: initial.selectedTextModelId || '',
    sessions: initial.sessions || {},
    currentTask: null,
    abortController: null,

    sceneConfig: initial.sceneConfig,
    visionConfig: initial.visionConfig,
    chapterConfig: initial.chapterConfig,

    setIsAiCenterOpen: (open) => set({ isAiCenterOpen: open }),
    toggleAiCenterOpen: () => set((s) => ({ isAiCenterOpen: !s.isAiCenterOpen })),
    setActiveTab: (tab) => set({ activeTab: tab }),

    updateSceneConfig: (partial) => {
      set((s) => {
        const next = { ...s.sceneConfig, ...partial };
        persistAi({ sceneConfig: next });
        return { sceneConfig: next };
      });
    },

    updateVisionConfig: (partial) => {
      set((s) => {
        const next = { ...s.visionConfig, ...partial };
        persistAi({ visionConfig: next });
        return { visionConfig: next };
      });
    },

    updateChapterConfig: (partial) => {
      set((s) => {
        const next = { ...s.chapterConfig, ...partial };
        persistAi({ chapterConfig: next });
        return { chapterConfig: next };
      });
    },

    setSelectedVisionModelId: (id) => {
      set({ selectedVisionModelId: id });
      persistAi({ selectedVisionModelId: id });
    },

    setSelectedTextModelId: (id) => {
      set({ selectedTextModelId: id });
      persistAi({ selectedTextModelId: id });
    },

    refreshOllama: async (providerId = 'ollama_default') => {
      const provider = get().providers.find((p) => p.id === providerId);
      if (!provider) return;

      set((s) => ({
        providers: s.providers.map((p) =>
          p.id === providerId ? { ...p, status: 'checking' } : p
        ),
      }));

      const res = await ProviderService.testOllamaConnection(provider.endpoint);

      set((s) => {
        const nextProviders = s.providers.map((p) => {
          if (p.id !== providerId) return p;
          return {
            ...p,
            status: res.success ? ('connected' as const) : ('error' as const),
            latencyMs: res.latencyMs,
            models: res.models,
            errorMessage: res.error,
            lastChecked: Date.now(),
          };
        });

        // Auto select first vision model if available, and first text model
        let visionModel = s.selectedVisionModelId;
        let textModel = s.selectedTextModelId;

        if (res.success && res.models.length > 0) {
          const firstVision = res.models.find((m) => m.capabilities.includes('vision'));
          if (firstVision && !visionModel) {
            visionModel = firstVision.id;
          }
          const firstText = res.models.find((m) => m.capabilities.includes('text'));
          if (firstText && !textModel) {
            textModel = firstText.id;
          }
        }

        persistAi({
          providers: nextProviders,
          selectedVisionModelId: visionModel,
          selectedTextModelId: textModel,
        });

        return {
          providers: nextProviders,
          selectedVisionModelId: visionModel,
          selectedTextModelId: textModel,
        };
      });
    },

    addCustomProvider: async (config) => {
      const newProvider: AiProviderConfig = {
        ...config,
        status: 'checking',
        models: [],
      };

      set((s) => {
        const next = [...s.providers, newProvider];
        persistAi({ providers: next });
        return { providers: next };
      });

      // Test connection immediately
      const testRes =
        newProvider.type === 'ollama'
          ? await ProviderService.testOllamaConnection(newProvider.endpoint)
          : await ProviderService.testOpenAICompatibleConnection(
              newProvider.endpoint,
              newProvider.apiKey
            );

      set((s) => {
        let finalModels = testRes.models;

        // Fallback default models if remote endpoint does not expose /models or has rate limits
        if (finalModels.length === 0) {
          const ep = (newProvider.endpoint || '').toLowerCase();
          const name = (newProvider.name || '').toLowerCase();
          if (ep.includes('openai.com') || name.includes('openai')) {
            finalModels = [
              { id: 'gpt-4o', name: 'gpt-4o (Omni Vision)', providerId: newProvider.id, capabilities: ['vision', 'text'], isLocal: false },
              { id: 'gpt-4o-mini', name: 'gpt-4o-mini (Fast & Cheap)', providerId: newProvider.id, capabilities: ['vision', 'text'], isLocal: false },
            ];
          } else if (ep.includes('deepseek.com') || name.includes('deepseek')) {
            finalModels = [
              { id: 'deepseek-chat', name: 'deepseek-chat (V3)', providerId: newProvider.id, capabilities: ['text'], isLocal: false },
              { id: 'deepseek-reasoner', name: 'deepseek-reasoner (R1)', providerId: newProvider.id, capabilities: ['text'], isLocal: false },
            ];
          } else if (ep.includes('groq.com') || name.includes('groq')) {
            finalModels = [
              { id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile', providerId: newProvider.id, capabilities: ['text'], isLocal: false },
              { id: 'llama-3.2-11b-vision-preview', name: 'llama-3.2-11b-vision-preview', providerId: newProvider.id, capabilities: ['vision', 'text'], isLocal: false },
            ];
          } else if (ep.includes('openrouter.ai') || name.includes('openrouter')) {
            finalModels = [
              { id: 'openai/gpt-4o', name: 'openai/gpt-4o', providerId: newProvider.id, capabilities: ['vision', 'text'], isLocal: false },
              { id: 'anthropic/claude-3.5-sonnet', name: 'anthropic/claude-3.5-sonnet', providerId: newProvider.id, capabilities: ['vision', 'text'], isLocal: false },
              { id: 'meta-llama/llama-3.3-70b-instruct', name: 'meta-llama/llama-3.3-70b-instruct', providerId: newProvider.id, capabilities: ['text'], isLocal: false },
            ];
          }
        }

        const next = s.providers.map((p) => {
          if (p.id !== newProvider.id) return p;
          return {
            ...p,
            status: testRes.success || finalModels.length > 0 ? ('connected' as const) : ('error' as const),
            latencyMs: testRes.latencyMs,
            models: finalModels,
            errorMessage: testRes.error,
            lastChecked: Date.now(),
          };
        });

        // Auto-select models if none selected
        let visionModel = s.selectedVisionModelId;
        let textModel = s.selectedTextModelId;

        const firstVision = finalModels.find((m) => m.capabilities.includes('vision'));
        if (firstVision && !visionModel) {
          visionModel = firstVision.id;
        }
        const firstText = finalModels.find((m) => m.capabilities.includes('text'));
        if (firstText && !textModel) {
          textModel = firstText.id;
        }

        persistAi({
          providers: next,
          selectedVisionModelId: visionModel,
          selectedTextModelId: textModel,
        });

        return {
          providers: next,
          selectedVisionModelId: visionModel,
          selectedTextModelId: textModel,
        };
      });
    },

    updateProvider: (id, partial) => {
      set((s) => {
        const next = s.providers.map((p) => (p.id === id ? { ...p, ...partial } : p));
        persistAi({ providers: next });
        return { providers: next };
      });
    },

    removeProvider: (id) => {
      set((s) => {
        const next = s.providers.filter((p) => p.id !== id);
        persistAi({ providers: next });
        return { providers: next };
      });
    },

    getOrCreateSession: (videoPath, duration = 0) => {
      const existing = get().sessions[videoPath];
      if (existing) {
        if (duration > 0 && existing.videoDuration <= 0) {
          existing.videoDuration = duration;
        }
        return existing;
      }

      const newSession: AiAnalysisSession = {
        videoPath,
        videoDuration: duration,
        analysisVersion: CURRENT_ANALYSIS_VERSION,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scenes: [],
        visionDescriptions: [],
        chapters: [],
        taskHistory: [],
      };

      set((s) => {
        const nextSessions = { ...s.sessions, [videoPath]: newSession };
        persistAi({ sessions: nextSessions });
        return { sessions: nextSessions };
      });

      return newSession;
    },

    updateChapter: (videoPath, chapterId, partial) => {
      set((s) => {
        const session = s.sessions[videoPath];
        if (!session) return s;

        const updatedChapters = session.chapters
          .map((c) => {
            if (c.id !== chapterId) return c;
            return {
              ...c,
              ...partial,
              isManualEdit: true,
            };
          })
          .sort((a, b) => a.startTime - b.startTime);

        // Harmonize contiguous endTimes
        for (let i = 0; i < updatedChapters.length - 1; i++) {
          if (
            updatedChapters[i].endTime <= updatedChapters[i].startTime ||
            updatedChapters[i].endTime > updatedChapters[i + 1].startTime
          ) {
            updatedChapters[i].endTime = updatedChapters[i + 1].startTime;
          }
        }
        if (updatedChapters.length > 0 && session.videoDuration > 0) {
          const last = updatedChapters[updatedChapters.length - 1];
          if (last.endTime <= last.startTime || last.endTime > session.videoDuration) {
            last.endTime = session.videoDuration;
          }
        }

        const nextSession: AiAnalysisSession = {
          ...session,
          chapters: updatedChapters,
          updatedAt: Date.now(),
        };

        const nextSessions = { ...s.sessions, [videoPath]: nextSession };
        persistAi({ sessions: nextSessions });
        return { sessions: nextSessions };
      });
    },

    deleteChapter: (videoPath, chapterId) => {
      set((s) => {
        const session = s.sessions[videoPath];
        if (!session) return s;

        const nextChapters = session.chapters.filter((c) => c.id !== chapterId);
        const nextSession: AiAnalysisSession = {
          ...session,
          chapters: nextChapters,
          updatedAt: Date.now(),
        };

        const nextSessions = { ...s.sessions, [videoPath]: nextSession };
        persistAi({ sessions: nextSessions });
        return { sessions: nextSessions };
      });
    },

    addChapter: (videoPath, chapter) => {
      set((s) => {
        const session = s.sessions[videoPath];
        if (!session) return s;

        const list = [...session.chapters, { ...chapter, isManualEdit: true }].sort(
          (a, b) => a.startTime - b.startTime
        );

        // Harmonize endTimes so timeline has no gaps
        for (let i = 0; i < list.length; i++) {
          if (i < list.length - 1) {
            list[i].endTime = list[i + 1].startTime;
          } else {
            list[i].endTime =
              session.videoDuration > list[i].startTime
                ? session.videoDuration
                : list[i].startTime + 30;
          }
        }

        const nextSession: AiAnalysisSession = {
          ...session,
          chapters: list,
          updatedAt: Date.now(),
        };

        const nextSessions = { ...s.sessions, [videoPath]: nextSession };
        persistAi({ sessions: nextSessions });
        return { sessions: nextSessions };
      });
    },

    clearSession: (videoPath) => {
      set((s) => {
        const nextSessions = { ...s.sessions };
        delete nextSessions[videoPath];
        persistAi({ sessions: nextSessions });
        return { sessions: nextSessions };
      });
    },

    cancelCurrentTask: () => {
      const abortCtrl = get().abortController;
      if (abortCtrl) {
        abortCtrl.abort();
      }
      set((s) => {
        if (!s.currentTask) return { abortController: null };
        return {
          abortController: null,
          currentTask: {
            ...s.currentTask,
            status: 'cancelled',
            finishTime: Date.now(),
          },
        };
      });
    },

    runSceneDetection: async (videoPath, duration) => {
      if (get().currentTask?.status === 'running') return;

      const abortController = new AbortController();
      const visionModelId = get().selectedVisionModelId;
      const visionProvider = visionModelId
        ? get().providers.find(
          (provider) => provider.isEnabled && provider.models.some((model) => model.id === visionModelId)
        )
        : undefined;
      const visionVerificationEnabled = Boolean(
        get().sceneConfig.useVisionVerification && visionProvider && visionModelId
      );
      const task: AiTask = {
        id: `task_scene_${Date.now()}`,
        type: 'scene_detection',
        title: visionVerificationEnabled
          ? `AI-assisted Scene Cut Detection (${visionModelId})`
          : 'Scene Cut Detection (visual fallback)',
        status: 'running',
        startTime: Date.now(),
        providerId: visionVerificationEnabled ? visionProvider?.id : undefined,
        modelId: visionVerificationEnabled ? visionModelId : undefined,
        progress: {
          currentUnit: 0,
          totalUnits: 100,
          percent: 0,
          unitLabel: 'frames',
          stageDescription: visionVerificationEnabled
            ? 'Finding visual candidates for vision-model review...'
            : 'Initializing offline visual-difference fallback...',
        },
      };

      set({ currentTask: task, abortController });

      try {
        const scenes = await SceneDetectionEngine.detectScenes({
          filePath: videoPath,
          duration,
          config: get().sceneConfig,
          visionProvider,
          visionModelId,
          signal: abortController.signal,
          onProgress: (p) => {
            set((s) => {
              if (!s.currentTask || abortController.signal.aborted) return s;
              return {
                currentTask: {
                  ...s.currentTask,
                  progress: p,
                },
              };
            });
          },
        });

        if (abortController.signal.aborted) {
          return;
        }

        // Store detected scenes in session
        set((s) => {
          const session = s.getOrCreateSession(videoPath, duration);
          const cutCount = scenes.length;
          const finalProgress: TaskWorkProgress = {
            currentUnit: cutCount,
            totalUnits: cutCount,
            percent: 100,
            unitLabel: 'AI-confirmed cuts',
            stageDescription: cutCount > 0
              ? `Placed ${cutCount} AI-confirmed cut marker${cutCount === 1 ? '' : 's'} on the timeline.`
              : 'No AI-confirmed scene cuts. No timeline markers were added.',
            modelStats: s.currentTask?.progress.modelStats,
          };
          const finishedTask: AiTask = {
            ...task,
            status: 'completed',
            progress: finalProgress,
            finishTime: Date.now(),
          };
          const nextSession: AiAnalysisSession = {
            ...session,
            analysisVersion: CURRENT_ANALYSIS_VERSION,
            scenes,
            visionDescriptions: [],
            chapters: session.chapters.filter((chapter) => chapter.isManualEdit),
            updatedAt: Date.now(),
            taskHistory: [...session.taskHistory, finishedTask],
          };

          const nextSessions = { ...s.sessions, [videoPath]: nextSession };
          persistAi({ sessions: nextSessions });

          return {
            sessions: nextSessions,
            currentTask: finishedTask,
            abortController: null,
          };
        });
      } catch (err: any) {
        console.error('Scene detection task error:', err);
        set((state) => ({
          currentTask: {
            ...task,
            // Keep the last real stage so a failed VLM request is distinguishable
            // from a failure while scanning or decoding the video.
            progress: state.currentTask?.progress || task.progress,
            status: abortController.signal.aborted ? 'cancelled' : 'failed',
            error: abortController.signal.aborted ? undefined : (err.message || 'Scene detection failed'),
            finishTime: Date.now(),
          },
          abortController: null,
        }));
        throw err;
      }
    },

    runVisionAnalysis: async (videoPath) => {
      if (get().currentTask?.status === 'running') return;

      const session = get().sessions[videoPath];
      if (!session || session.scenes.length === 0) {
        throw new Error('Please run Scene Detection first to establish keyframe points');
      }

      const visionModelId = get().selectedVisionModelId;
      if (!visionModelId) {
        throw new Error('No vision model selected. Please select a vision model in Provider Settings.');
      }

      // Robust provider resolution: match provider owning this model
      const allProviders = get().providers;
      let provider = allProviders.find(
        (p) => p.isEnabled && p.models.some((m) => m.id === visionModelId)
      );
      if (!provider) throw new Error(`The selected vision model "${visionModelId}" is not available from an enabled provider.`);

      const abortController = new AbortController();
      const visionConfig = {
        ...get().visionConfig,
        modelId: visionModelId,
        promptOverride:
          get().visionConfig.promptOverride ||
          `Describe only what is visibly present in this video frame. Return concise JSON with summary, objects, and activity. Write the summary and activity in ${get().chapterConfig.language}. Do not infer events outside this frame.`,
      };
      const plannedFrames = ChapterEngine.buildVisionSamplePlan(
        session.scenes,
        visionConfig,
        session.videoDuration
      );

      const task: AiTask = {
        id: `task_vision_${Date.now()}`,
        type: 'vision_analysis',
        title: `Vision Analysis (${visionModelId})`,
        status: 'running',
        startTime: Date.now(),
        providerId: provider.id,
        modelId: visionModelId,
        progress: {
          currentUnit: 0,
          totalUnits: plannedFrames.length,
          percent: 0,
          unitLabel: 'frames',
          stageDescription: 'Starting vision frame sampling...',
        },
      };

      set({ currentTask: task, abortController });

      try {
        const descriptions = await ChapterEngine.runVisionAnalysis({
          filePath: videoPath,
          scenes: session.scenes,
          videoDuration: session.videoDuration,
          provider,
          config: visionConfig,
          signal: abortController.signal,
          onProgress: (p) => {
            set((s) => {
              if (!s.currentTask || abortController.signal.aborted) return s;
              return {
                currentTask: {
                  ...s.currentTask,
                  progress: p,
                },
              };
            });
          },
        });

        if (abortController.signal.aborted) {
          return;
        }

        set((s) => {
          const currentSess = s.sessions[videoPath] || session;
          const finalProgress: TaskWorkProgress = {
            currentUnit: descriptions.length,
            totalUnits: plannedFrames.length,
            percent: 100,
            unitLabel: 'frames analyzed',
            stageDescription: `Completed: Analyzed ${descriptions.length} of ${plannedFrames.length} selected keyframes.`,
            modelStats: s.currentTask?.progress.modelStats,
          };
          const finishedTask: AiTask = {
            ...task,
            status: 'completed',
            progress: finalProgress,
            finishTime: Date.now(),
          };
          const nextSession: AiAnalysisSession = {
            ...currentSess,
            visionDescriptions: descriptions,
            updatedAt: Date.now(),
            taskHistory: [...currentSess.taskHistory, finishedTask],
          };

          const nextSessions = { ...s.sessions, [videoPath]: nextSession };
          persistAi({ sessions: nextSessions });

          return {
            sessions: nextSessions,
            currentTask: finishedTask,
            abortController: null,
          };
        });
      } catch (err: any) {
        console.error('Vision analysis error:', err);
        set(() => ({
          currentTask: {
            ...task,
            status: abortController.signal.aborted ? 'cancelled' : 'failed',
            error: abortController.signal.aborted ? undefined : (err.message || 'Vision analysis failed'),
            finishTime: Date.now(),
          },
          abortController: null,
        }));
        throw err;
      }
    },

    runSmartChapters: async (videoPath, duration) => {
      if (get().currentTask?.status === 'running') return;

      const failPreparation = (message: string): never => {
        set({
          currentTask: {
            id: `task_chapters_${Date.now()}`,
            type: 'smart_chapters',
            title: 'Content-based chapter generation',
            status: 'failed',
            startTime: Date.now(),
            finishTime: Date.now(),
            error: message,
            progress: {
              currentUnit: 0,
              totalUnits: 3,
              percent: 0,
              unitLabel: 'stages',
              stageDescription: 'Could not prepare visual evidence for chapter generation.',
            },
          },
          abortController: null,
        });
        throw new Error(message);
      };

      let session = get().getOrCreateSession(videoPath, duration);
      if (session.scenes.length === 0 || session.analysisVersion !== CURRENT_ANALYSIS_VERSION) {
        await get().runSceneDetection(videoPath, duration);
        session = get().sessions[videoPath] || session;
      }

      if (!session || session.scenes.length === 0) {
        failPreparation('No video scenes could be analyzed. Try another video or run Scene Detection separately.');
      }

      const usableVisionResults = session.visionDescriptions.filter(
        (description) =>
          Number.isFinite(description.timestamp) &&
          description.timestamp >= 0 &&
          description.timestamp <= session.videoDuration + 0.5 &&
          isUsableVisionSummary(description.summary)
      );
      const hasCurrentVisionResults =
        usableVisionResults.length >=
        (session.visionDescriptions.length <= 1
          ? 1
          : Math.ceil(session.visionDescriptions.length * 0.75));
      if (!hasCurrentVisionResults) {
        if (!get().selectedVisionModelId) {
          failPreparation('Select a vision model in Provider Settings to analyze this video before creating content-based chapters.');
        }
        await get().runVisionAnalysis(videoPath);
        session = get().sessions[videoPath] || session;
      }

      if (!session?.visionDescriptions?.length) {
        failPreparation('No video frames were successfully analyzed, so content-based chapters could not be created.');
      }

      const scenes = session.scenes;

      const selectedTextModelId = get().selectedTextModelId;
      const synthesisModelId = selectedTextModelId || get().selectedVisionModelId;
      // Prefer a dedicated text model, then use the selected multimodal model to synthesize its own observations.
      const allProviders = get().providers;
      let provider: AiProviderConfig | undefined;
      if (synthesisModelId) {
        provider = allProviders.find(
          (p) => p.isEnabled && p.models.some((m) => m.id === synthesisModelId)
        );
      }

      const abortController = new AbortController();

      const task: AiTask = {
        id: `task_chapters_${Date.now()}`,
        type: 'smart_chapters',
        title: 'Smart Chapters Synthesis',
        status: 'running',
        startTime: Date.now(),
        providerId: provider?.id,
        modelId: synthesisModelId,
        progress: {
          currentUnit: 0,
          totalUnits: 3,
          percent: 0,
          unitLabel: 'stages',
        stageDescription: 'Grouping analyzed video content into chapters...',
        },
      };

      set({ currentTask: task, abortController });

      try {
        const chapters = await ChapterEngine.generateSmartChapters({
          videoDuration: duration,
          scenes,
          visionDescriptions: session.visionDescriptions,
          existingChapters: session.chapters,
          provider: provider && synthesisModelId ? provider : undefined,
          config: {
            ...get().chapterConfig,
            modelId: synthesisModelId,
          },
          signal: abortController.signal,
          onProgress: (p) => {
            set((s) => {
              if (!s.currentTask || abortController.signal.aborted) return s;
              return {
                currentTask: {
                  ...s.currentTask,
                  progress: p,
                },
              };
            });
          },
        });

        if (abortController.signal.aborted) {
          return;
        }

        set((s) => {
          const currentSess = s.sessions[videoPath] || session;
          const finalProgress: TaskWorkProgress = {
            currentUnit: chapters.length,
            totalUnits: chapters.length,
            percent: 100,
            unitLabel: 'chapters',
            stageDescription: `Synthesized ${chapters.length} smart chapters.`,
            modelStats: s.currentTask?.progress.modelStats,
          };
          const finishedTask: AiTask = {
            ...task,
            status: 'completed',
            progress: finalProgress,
            finishTime: Date.now(),
          };
          const nextSession: AiAnalysisSession = {
            ...currentSess,
            chapters,
            updatedAt: Date.now(),
            taskHistory: [...currentSess.taskHistory, finishedTask],
          };

          const nextSessions = { ...s.sessions, [videoPath]: nextSession };
          persistAi({ sessions: nextSessions });

          return {
            sessions: nextSessions,
            currentTask: finishedTask,
            abortController: null,
          };
        });
      } catch (err: any) {
        console.error('Smart Chapters error:', err);
        set(() => ({
          currentTask: {
            ...task,
            status: abortController.signal.aborted ? 'cancelled' : 'failed',
            error: abortController.signal.aborted ? undefined : (err.message || 'Smart chapters synthesis failed'),
            finishTime: Date.now(),
          },
          abortController: null,
        }));
        throw err;
      }
    },
  };
});
