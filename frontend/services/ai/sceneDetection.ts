import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { AiProviderConfig, ModelRuntimeStats, SceneMark, SceneDetectionConfig, TaskWorkProgress } from '../../types/ai';
import { ChapterEngine } from './chapterEngine';
import { ProviderService } from './providerService';

export interface SceneDetectionOptions {
  filePath: string;
  duration: number;
  config: SceneDetectionConfig;
  onProgress: (progress: TaskWorkProgress) => void;
  signal?: AbortSignal;
  visionProvider?: AiProviderConfig;
  visionModelId?: string;
}

interface FrameSignature {
  colorHistogram: Float32Array;
  luminanceHistogram: Float32Array;
  spatialLuminance: Float32Array;
  averageLuminance: number;
}

interface PendingCut {
  timestamp: number;
  before: FrameSignature;
  after: FrameSignature;
  score: number;
  threshold: number;
  thumbnailDataUrl?: string;
  beforeFrameDataUrl?: string;
  afterFrameDataUrl?: string;
}

/** Frame pairs are kept only while the VLM is reviewing candidates; they are never persisted. */
interface VisionCandidate extends SceneMark {
  beforeFrameDataUrl?: string;
  afterFrameDataUrl?: string;
}

const COLOR_BINS = 64;
const LUMINANCE_BINS = 8;
const GRID_COLUMNS = 4;
const GRID_ROWS = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildFrameSignature(imageData: ImageData): FrameSignature {
  const { data, width, height } = imageData;
  const colorHistogram = new Float32Array(COLOR_BINS);
  const luminanceHistogram = new Float32Array(LUMINANCE_BINS);
  const spatialSums = new Float32Array(GRID_COLUMNS * GRID_ROWS);
  const spatialCounts = new Uint16Array(GRID_COLUMNS * GRID_ROWS);
  let luminanceTotal = 0;

  for (let y = 0; y < height; y++) {
    const gridY = Math.min(GRID_ROWS - 1, Math.floor((y / height) * GRID_ROWS));
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const colorBin = (r >> 6) * 16 + (g >> 6) * 4 + (b >> 6);
      const luminanceBin = Math.min(LUMINANCE_BINS - 1, Math.floor(luminance * LUMINANCE_BINS));
      const gridIndex = gridY * GRID_COLUMNS + Math.min(GRID_COLUMNS - 1, Math.floor((x / width) * GRID_COLUMNS));

      colorHistogram[colorBin]++;
      luminanceHistogram[luminanceBin]++;
      spatialSums[gridIndex] += luminance;
      spatialCounts[gridIndex]++;
      luminanceTotal += luminance;
    }
  }

  const pixelCount = Math.max(1, width * height);
  const spatialLuminance = new Float32Array(spatialSums.length);
  for (let index = 0; index < spatialSums.length; index++) {
    spatialLuminance[index] = spatialSums[index] / Math.max(1, spatialCounts[index]);
  }
  for (let index = 0; index < COLOR_BINS; index++) colorHistogram[index] /= pixelCount;
  for (let index = 0; index < LUMINANCE_BINS; index++) luminanceHistogram[index] /= pixelCount;

  return {
    colorHistogram,
    luminanceHistogram,
    spatialLuminance,
    averageLuminance: luminanceTotal / pixelCount,
  };
}

function distributionDistance(left: Float32Array, right: Float32Array): number {
  let total = 0;
  for (let index = 0; index < left.length; index++) total += Math.abs(left[index] - right[index]);
  return total / 2;
}

/** A 0..1 score that favours actual shot changes over small camera motion. */
export function frameSignatureDistance(left: FrameSignature, right: FrameSignature): number {
  const colorDistance = distributionDistance(left.colorHistogram, right.colorHistogram);
  const luminanceDistance = distributionDistance(left.luminanceHistogram, right.luminanceHistogram);
  let spatialDistance = 0;
  for (let index = 0; index < left.spatialLuminance.length; index++) {
    spatialDistance += Math.abs(left.spatialLuminance[index] - right.spatialLuminance[index]);
  }
  spatialDistance /= left.spatialLuminance.length;
  const exposureDistance = Math.abs(left.averageLuminance - right.averageLuminance);
  return colorDistance * 0.5 + luminanceDistance * 0.2 + spatialDistance * 0.2 + exposureDistance * 0.1;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

function canVerifyWithVision(options: SceneDetectionOptions): options is SceneDetectionOptions & {
  visionProvider: AiProviderConfig;
  visionModelId: string;
} {
  return Boolean(
    options.config.useVisionVerification &&
    options.visionProvider &&
    options.visionModelId
  );
}

export class SceneDetectionEngine {
  /**
   * Keyframes are a robust native fallback when WebView cannot decode a file.
   * They are candidates for Vision sampling, not guaranteed editorial scene cuts.
   */
  static async detectScenesWithNativeFfprobe(options: SceneDetectionOptions): Promise<SceneMark[]> {
    const { filePath, config, onProgress } = options;
    onProgress({
      currentUnit: 20,
      totalUnits: 100,
      percent: 20,
      unitLabel: 'frames',
      stageDescription: 'Finding video keyframe candidates with the native decoder...',
    });

    const minGap = Math.max(5, config.minSceneDurationSeconds || 4);
    try {
      const timestamps = await invoke<number[]>('detect_video_scenes', { path: filePath, minGapSeconds: minGap });
      onProgress({
        currentUnit: 100,
        totalUnits: 100,
        percent: 100,
        unitLabel: 'frames',
        stageDescription: `Found ${timestamps.length} keyframe candidates with the native decoder.`,
      });
      // Keep an internal baseline at 00:00 for the Vision comparison. It is not a
      // scene cut and is removed before detection results are returned to the UI.
      const candidates = timestamps
        .map((timestamp) => Number(timestamp.toFixed(2)))
        .filter((timestamp) => timestamp > 0.01)
        .map((timestamp, index) => ({
          id: `scene_native_${index + 1}`,
          timestamp,
          confidence: 0.55,
          label: `Native cut candidate ${index + 1}`,
        }));

      return [
        { id: 'scene_start', timestamp: 0, confidence: 1, label: 'Beginning' },
        ...candidates,
      ];
    } catch (error: any) {
      console.error('Native keyframe detection failed:', error);
      throw new Error(`Scene detection failed: ${error?.message || error}`);
    }
  }

  /**
   * The histogram pass is intentionally only a candidate generator. A returned marker is
   * kept only after the configured VLM compared a decoded frame on either side of it.
   */
  private static async verifyCandidatesWithVision(
    candidates: VisionCandidate[],
    options: SceneDetectionOptions
  ): Promise<SceneMark[]> {
    if (!canVerifyWithVision(options) || candidates.length <= 1) return candidates;

    const { filePath, duration, config, onProgress, signal, visionProvider, visionModelId } = options;
    const maximum = Math.max(1, Math.min(48, Math.round(config.maxVisionCandidates || 24)));
    const possibleCuts = candidates.slice(1);
    const prioritized = [...possibleCuts]
      .sort((left, right) => ((right.score ?? right.confidence) - (left.score ?? left.confidence)));
    const selectedIds = new Set(prioritized.slice(0, maximum).map((scene) => scene.id));
    const cutsToVerify = possibleCuts.filter((scene) => selectedIds.has(scene.id));
    const verifiedScenes: SceneMark[] = [candidates[0]];
    const frameOffset = Math.max(0.2, Math.min(0.6, (config.sampleIntervalSeconds || 0.8) / 2));
    let requestFailures = 0;
    const failureReasons: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalGenerationSeconds = 0;
    let reviewedRequests = 0;
    let modelStats: ModelRuntimeStats | undefined;

    const recordModelStats = (latest?: ModelRuntimeStats) => {
      if (!latest) return modelStats;
      reviewedRequests += latest.requestCount;
      totalInputTokens += latest.inputTokens || 0;
      totalOutputTokens += latest.outputTokens || 0;
      totalGenerationSeconds += latest.generationSeconds || 0;
      modelStats = {
        ...latest,
        requestCount: reviewedRequests,
        inputTokens: totalInputTokens || undefined,
        outputTokens: totalOutputTokens || undefined,
        totalTokens: (totalInputTokens + totalOutputTokens) || undefined,
        outputTokensPerSecond: totalOutputTokens && totalGenerationSeconds
          ? totalOutputTokens / totalGenerationSeconds
          : latest.outputTokensPerSecond,
        generationSeconds: totalGenerationSeconds || undefined,
      };
      return modelStats;
    };

    for (let index = 0; index < cutsToVerify.length; index++) {
      if (signal?.aborted) break;
      const candidate = cutsToVerify[index];
      onProgress({
        currentUnit: index,
        totalUnits: cutsToVerify.length,
        percent: Math.round((index / Math.max(1, cutsToVerify.length)) * 100),
        unitLabel: 'AI cut reviews',
        stageDescription: `Vision model is reviewing candidate ${index + 1} of ${cutsToVerify.length} near ${Math.round(candidate.timestamp)}s...`,
        modelStats,
      });

      try {
        // Reuse the frame pair captured during the scan. A separate decode is only a
        // resilience path for native keyframe candidates, which do not have thumbnails.
        const before = candidate.beforeFrameDataUrl || await ChapterEngine.captureFrameBase64(
          filePath, Math.max(0, candidate.timestamp - frameOffset), 480
        );
        const after = candidate.afterFrameDataUrl || await ChapterEngine.captureFrameBase64(
          filePath, Math.min(duration, candidate.timestamp + frameOffset), 480
        );
        const decision = await ProviderService.verifySceneCutWithVision(
          visionProvider,
          visionModelId,
          before,
          after,
          signal
        );
        recordModelStats(decision.modelStats);
        if (decision.isSceneCut && decision.confidence >= 0.55) {
          verifiedScenes.push({
            id: candidate.id,
            timestamp: candidate.timestamp,
            score: candidate.score,
            thumbnailDataUrl: candidate.thumbnailDataUrl,
            confidence: Number(decision.confidence.toFixed(2)),
            label: `AI-verified cut ${verifiedScenes.length + 1}`,
          });
        }
      } catch (error) {
        if (signal?.aborted) break;
        requestFailures++;
        failureReasons.push(error instanceof Error ? error.message : String(error));
        console.warn(`Vision verification failed near ${candidate.timestamp}s:`, error);
      }

      onProgress({
        currentUnit: index + 1,
        totalUnits: cutsToVerify.length,
        percent: Math.round(((index + 1) / Math.max(1, cutsToVerify.length)) * 100),
        unitLabel: 'AI cut reviews',
        stageDescription: `Vision reviewed ${index + 1} of ${cutsToVerify.length} candidates (${verifiedScenes.length - 1} cuts confirmed).`,
        modelStats,
      });
    }

    if (!signal?.aborted && cutsToVerify.length > 0 && requestFailures === cutsToVerify.length) {
      const detail = failureReasons[0] ? ` ${failureReasons[0]}` : '';
      throw new Error(`The vision model could not review any scene-cut candidates.${detail}`);
    }

    return verifiedScenes.sort((left, right) => left.timestamp - right.timestamp);
  }

  private static async detectNativeCandidatesAndVerify(options: SceneDetectionOptions): Promise<SceneMark[]> {
    const candidates: VisionCandidate[] = await this.detectScenesWithNativeFfprobe(options);
    const verified = await this.verifyCandidatesWithVision(candidates, options);
    return verified.filter((scene) => scene.timestamp > 0.01);
  }

  /**
   * Detect editorial cut candidates with a compact visual signature.
   * Histogram comparison resists small pans, while the one-frame confirmation removes flashes.
   */
  static async detectScenes(options: SceneDetectionOptions): Promise<SceneMark[]> {
    const { filePath, duration, config, onProgress, signal } = options;
    if (duration <= 0) throw new Error('Video duration must be greater than 0');

    const extension = filePath.split('.').pop()?.toLowerCase();
    const unsupportedWebViewContainers = new Set([
      'mkv', 'avi', 'flv', 'ts', 'mts', 'm2ts', 'wmv', 'vob', 'mov', 'rmvb', 'asf',
    ]);
    if (unsupportedWebViewContainers.has(extension || '')) return this.detectNativeCandidatesAndVerify(options);

    let sampleInterval = config.sampleIntervalSeconds || 0.5;
    if (canVerifyWithVision(options)) {
      // The VLM decides whether an interval contains a genuine edit. A shorter
      // interval gives it a much tighter before/after pair and a more precise marker.
      sampleInterval = Math.min(sampleInterval, duration > 1800 ? 1 : 0.5);
    } else if (duration > 1800) {
      sampleInterval = Math.max(sampleInterval, 2);
    } else if (duration > 300) {
      sampleInterval = Math.max(sampleInterval, 1);
    }

    const minSceneGap = Math.max(3.5, config.minSceneDurationSeconds || 4);
    const sensitivity = clamp(config.sensitivity ?? 0.35, 0.1, 0.9);
    const baseThreshold = 0.22 - sensitivity * 0.08;
    const timestamps: number[] = [];
    for (let timestamp = 0; timestamp < duration; timestamp += sampleInterval) timestamps.push(timestamp);

    // This baseline lets the scan compare the first sampled frame, but is never
    // returned as a cut marker. A marker means an actual AI-confirmed boundary.
    const detectedScenes: VisionCandidate[] = [{ id: 'scene_start', timestamp: 0, confidence: 1, label: 'Beginning' }];
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    try {
      video.src = convertFileSrc(filePath);
    } catch {
      return this.detectNativeCandidatesAndVerify(options);
    }

    const metadataLoaded = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
        resolve(value);
      };
      const onLoaded = () => finish(true);
      const onError = () => finish(false);
      const timeout = setTimeout(() => finish(false), 3500);
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
    });
    if (!metadataLoaded) {
      video.src = '';
      video.remove();
      return this.detectNativeCandidatesAndVerify(options);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = 320;
    thumbnailCanvas.height = 180;
    const thumbnailContext = thumbnailCanvas.getContext('2d');
    const previousFrameCanvas = document.createElement('canvas');
    previousFrameCanvas.width = thumbnailCanvas.width;
    previousFrameCanvas.height = thumbnailCanvas.height;
    const previousFrameContext = previousFrameCanvas.getContext('2d');
    if (!context) {
      video.src = '';
      video.remove();
      canvas.remove();
      thumbnailCanvas.remove();
      previousFrameCanvas.remove();
      return this.detectNativeCandidatesAndVerify(options);
    }

    let previousSignature: FrameSignature | null = null;
    let lastSceneTime = 0;
    let pendingCut: PendingCut | null = null;
    let consecutiveSeekFailures = 0;
    const recentScores: number[] = [];
    const startTime = performance.now();

    const acceptPendingCut = (nextSignature?: FrameSignature) => {
      if (!pendingCut) return;
      const returnedToPrevious = nextSignature
        ? frameSignatureDistance(pendingCut.before, nextSignature) < Math.max(0.035, pendingCut.threshold * 0.55)
        : false;
      if (!returnedToPrevious) {
        const confidence = clamp((pendingCut.score - pendingCut.threshold) / Math.max(0.08, 0.45 - pendingCut.threshold), 0, 1);
        detectedScenes.push({
          id: `scene_${detectedScenes.length}`,
          timestamp: Number(pendingCut.timestamp.toFixed(2)),
          confidence: Number((0.45 + confidence * 0.55).toFixed(2)),
          score: Number(pendingCut.score.toFixed(3)),
          thumbnailDataUrl: pendingCut.thumbnailDataUrl,
          beforeFrameDataUrl: pendingCut.beforeFrameDataUrl,
          afterFrameDataUrl: pendingCut.afterFrameDataUrl,
          label: `Visual candidate ${detectedScenes.length}`,
        });
        lastSceneTime = pendingCut.timestamp;
      }
      pendingCut = null;
    };

    try {
      for (let index = 0; index < timestamps.length; index++) {
        if (signal?.aborted) break;
        const timestamp = timestamps[index];
        const seekOk = await new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (value: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);
            resolve(value);
          };
          const onSeeked = () => finish(true);
          const timeout = setTimeout(() => finish(false), 1200);
          if (signal?.aborted) return finish(false);
          video.addEventListener('seeked', onSeeked, { once: true });
          video.currentTime = timestamp;
        });

        if (signal?.aborted) break;
        if (!seekOk) {
          consecutiveSeekFailures++;
          if (consecutiveSeekFailures >= 3 || index === 0) {
            video.src = '';
            video.remove();
            canvas.remove();
            thumbnailCanvas.remove();
            previousFrameCanvas.remove();
            return this.detectNativeCandidatesAndVerify(options);
          }
          continue;
        }
        consecutiveSeekFailures = 0;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentFrameData = context.getImageData(0, 0, canvas.width, canvas.height);
        const currentSignature = buildFrameSignature(currentFrameData);
        if (!previousSignature) {
          if (config.generateThumbnails && thumbnailContext) {
            thumbnailContext.drawImage(video, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
            detectedScenes[0].thumbnailDataUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.55);
          }
        } else {
          acceptPendingCut(currentSignature);
          const score = frameSignatureDistance(previousSignature, currentSignature);
          const adaptiveThreshold = Math.max(baseThreshold, percentile(recentScores, 0.8) * 1.45);
          recentScores.push(score);
          if (recentScores.length > 30) recentScores.shift();
          if (score >= adaptiveThreshold && timestamp - lastSceneTime >= minSceneGap) {
            let thumbnailDataUrl: string | undefined;
            let beforeFrameDataUrl: string | undefined;
            let afterFrameDataUrl: string | undefined;
            const captureCandidateFrames = config.generateThumbnails || canVerifyWithVision(options);
            if (captureCandidateFrames && thumbnailContext) {
              if (previousFrameContext) {
                // Keep a real 320×180 frame from the prior sample. Upscaling the
                // 64×36 detection signature hid the visual details the VLM needs.
                beforeFrameDataUrl = previousFrameCanvas.toDataURL('image/jpeg', 0.72);
              }
              thumbnailContext.drawImage(video, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
              afterFrameDataUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.72);
              thumbnailDataUrl = config.generateThumbnails ? afterFrameDataUrl : undefined;
            }
            pendingCut = {
              timestamp, before: previousSignature, after: currentSignature, score, threshold: adaptiveThreshold,
              thumbnailDataUrl, beforeFrameDataUrl, afterFrameDataUrl,
            };
          }
        }
        previousSignature = currentSignature;
        previousFrameContext?.drawImage(video, 0, 0, previousFrameCanvas.width, previousFrameCanvas.height);

        const currentUnit = index + 1;
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        const rate = currentUnit / Math.max(elapsedSeconds, 0.001);
        onProgress({
          currentUnit,
          totalUnits: timestamps.length,
          percent: Math.min(100, Math.round((currentUnit / timestamps.length) * 100)),
          unitLabel: 'frames sampled',
          stageDescription: `Checking visual changes at ${Math.round(timestamp)}s (${detectedScenes.length - 1} candidates found)`,
          etaSeconds: rate > 0 ? Math.round((timestamps.length - currentUnit) / rate) : undefined,
        });
        if (index % 3 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      acceptPendingCut();
    } finally {
      video.src = '';
      video.remove();
      canvas.remove();
      thumbnailCanvas.remove();
      previousFrameCanvas.remove();
    }
    const verified = await this.verifyCandidatesWithVision(detectedScenes, options);
    return verified.filter((scene) => scene.timestamp > 0.01);
  }
}
