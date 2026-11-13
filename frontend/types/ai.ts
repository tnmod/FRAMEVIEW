export type AiTaskType =
  | 'scene_detection'
  | 'vision_analysis'
  | 'smart_chapters'
  | 'audio_transcription'
  | 'semantic_search';

export type AiTaskStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type ModelCapability = 'vision' | 'text' | 'embedding' | 'audio';

export type ProviderType = 'ollama' | 'openai_compatible' | 'custom';

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  capabilities: ModelCapability[];
  sizeBytes?: number;
  parameterSize?: string;
  family?: string;
  contextLength?: number;
  isLocal: boolean;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  apiKey?: string;
  isLocal: boolean;
  isEnabled: boolean;
  models: ModelInfo[];
  lastChecked?: number;
  status: 'connected' | 'disconnected' | 'checking' | 'error';
  errorMessage?: string;
  latencyMs?: number;
}

export interface TaskWorkProgress {
  currentUnit: number;
  totalUnits: number;
  percent: number; // 0 to 100
  unitLabel: string; // e.g. "frames", "scenes", "chunks"
  stageDescription: string;
  etaSeconds?: number;
  modelStats?: ModelRuntimeStats;
}

/** Runtime counters reported by the active AI provider. Values are cumulative for a task. */
export interface ModelRuntimeStats {
  modelId: string;
  requestCount: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  outputTokensPerSecond?: number;
  promptTokensPerSecond?: number;
  generationSeconds?: number;
  loadSeconds?: number;
  contextWindowTokens?: number;
}

export interface SceneMark {
  id: string;
  timestamp: number; // seconds
  confidence: number; // 0 to 1
  thumbnailDataUrl?: string;
  score?: number;
  label?: string;
}

export interface VisionDescription {
  timestamp: number;
  sceneId?: string;
  summary: string;
  objects: string[];
  activity?: string;
  thumbnailDataUrl?: string;
}

export interface SmartChapter {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  title: string;
  summary?: string;
  thumbnailDataUrl?: string;
  isManualEdit: boolean;
  sceneIds?: string[];
  tags?: string[];
}

export interface SceneDetectionConfig {
  sensitivity: number; // 0.1 to 0.9 (default 0.35)
  sampleIntervalSeconds: number; // sample every X seconds (e.g. 0.5s or 1s)
  minSceneDurationSeconds: number; // debounce scenes closer than X seconds (e.g. 2s)
  generateThumbnails: boolean;
  /** Use the selected vision model as the final decision maker for candidate cuts. */
  useVisionVerification: boolean;
  /** Keeps long videos practical while ensuring every returned cut was AI-confirmed. */
  maxVisionCandidates: number;
}

export interface VisionAnalysisConfig {
  providerId: string;
  modelId: string;
  sampleStrategy: 'scene_keyframes' | 'uniform_interval';
  intervalSeconds?: number;
  maxFramesToAnalyze?: number;
  promptOverride?: string;
}

export interface SmartChaptersConfig {
  providerId: string;
  modelId: string; // text or multimodal model to cluster & synthesize
  minChapterDurationSeconds: number; // default 15s
  targetChapterCount?: number;
  language: string; // e.g. "Vietnamese", "English", "Auto"
}

export interface AiTaskConfig {
  sceneDetection?: SceneDetectionConfig;
  visionAnalysis?: VisionAnalysisConfig;
  smartChapters?: SmartChaptersConfig;
}

export interface AiTask {
  id: string;
  type: AiTaskType;
  title: string;
  status: AiTaskStatus;
  progress: TaskWorkProgress;
  providerId?: string;
  modelId?: string;
  startTime?: number;
  finishTime?: number;
  error?: string;
  config?: AiTaskConfig;
}

export interface AiAnalysisSession {
  videoPath: string;
  videoDuration: number;
  analysisVersion?: number;
  videoFingerprint?: string;
  createdAt: number;
  updatedAt: number;
  scenes: SceneMark[];
  visionDescriptions: VisionDescription[];
  chapters: SmartChapter[];
  taskHistory: AiTask[];
}
